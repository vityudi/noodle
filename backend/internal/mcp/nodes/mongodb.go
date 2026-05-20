package nodes

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"github.com/vityudi/noodle/backend/internal/mcp/runtime"
)

// MongoDBNode runs an operation against a MongoDB collection.
//
// Config keys:
//
//	connection_string  string   — MongoDB URI (mongodb://user:pass@host:27017)
//	database           string   — database name
//	collection         string   — collection name
//	operation          string   — find | findOne | insertOne | insertMany |
//	                             updateOne | updateMany | deleteOne | deleteMany |
//	                             countDocuments | aggregate
//	filter             object   — query filter (find, update, delete, count)
//	document           object   — document to insert or update fields
//	documents          []object — documents to insert (insertMany)
//	pipeline           []object — aggregation pipeline (aggregate)
//	limit              number   — max results (find)
//	sort               object   — sort spec e.g. {"created_at": -1} (find)
//
// Outputs vary by operation — see each case below.
type MongoDBNode struct{}

func (n *MongoDBNode) Execute(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	connStr, _ := config["connection_string"].(string)
	if connStr == "" {
		return nil, fmt.Errorf("mongodb: connection_string is required")
	}
	database, _ := config["database"].(string)
	collection, _ := config["collection"].(string)
	operation, _ := config["operation"].(string)
	if database == "" || collection == "" || operation == "" {
		return nil, fmt.Errorf("mongodb: database, collection, and operation are required")
	}

	connCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(connCtx, options.Client().ApplyURI(connStr))
	if err != nil {
		return nil, fmt.Errorf("mongodb: connect: %w", err)
	}
	defer client.Disconnect(ctx) //nolint:errcheck

	coll := client.Database(database).Collection(collection)

	filter := toBSON(config["filter"])

	writeOps := map[string]bool{"insertOne": true, "insertMany": true, "updateOne": true, "updateMany": true, "deleteOne": true, "deleteMany": true}
	if writeOps[operation] && runtime.IsReadOnly(ctx) {
		return nil, fmt.Errorf("project is read-only: write operations (%s) are not allowed", operation)
	}

	switch operation {
	case "find":
		opts := options.Find()
		if l, ok := toInt64(config["limit"]); ok && l > 0 {
			opts.SetLimit(l)
		}
		if sort, ok := config["sort"].(map[string]interface{}); ok {
			opts.SetSort(bson.M(sort))
		}
		cursor, err := coll.Find(ctx, filter, opts)
		if err != nil {
			return nil, fmt.Errorf("mongodb: find: %w", err)
		}
		defer cursor.Close(ctx) //nolint:errcheck
		docs, err := decodeCursor(ctx, cursor)
		if err != nil {
			return nil, fmt.Errorf("mongodb: find decode: %w", err)
		}
		return map[string]interface{}{"documents": docs, "count": len(docs)}, nil

	case "findOne":
		var raw bson.Raw
		err := coll.FindOne(ctx, filter).Decode(&raw)
		if err == mongo.ErrNoDocuments {
			return map[string]interface{}{"document": nil, "found": false}, nil
		}
		if err != nil {
			return nil, fmt.Errorf("mongodb: findOne: %w", err)
		}
		doc, err := bsonRawToMap(raw)
		if err != nil {
			return nil, fmt.Errorf("mongodb: findOne decode: %w", err)
		}
		return map[string]interface{}{"document": doc, "found": true}, nil

	case "insertOne":
		doc, _ := config["document"].(map[string]interface{})
		res, err := coll.InsertOne(ctx, doc)
		if err != nil {
			return nil, fmt.Errorf("mongodb: insertOne: %w", err)
		}
		return map[string]interface{}{"inserted_id": fmt.Sprintf("%v", res.InsertedID)}, nil

	case "insertMany":
		rawDocs, _ := config["documents"].([]interface{})
		docs := make([]interface{}, len(rawDocs))
		copy(docs, rawDocs)
		res, err := coll.InsertMany(ctx, docs)
		if err != nil {
			return nil, fmt.Errorf("mongodb: insertMany: %w", err)
		}
		return map[string]interface{}{"inserted_count": len(res.InsertedIDs)}, nil

	case "updateOne":
		update := wrapUpdate(config["document"])
		res, err := coll.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, fmt.Errorf("mongodb: updateOne: %w", err)
		}
		return map[string]interface{}{
			"matched_count":  res.MatchedCount,
			"modified_count": res.ModifiedCount,
		}, nil

	case "updateMany":
		update := wrapUpdate(config["document"])
		res, err := coll.UpdateMany(ctx, filter, update)
		if err != nil {
			return nil, fmt.Errorf("mongodb: updateMany: %w", err)
		}
		return map[string]interface{}{
			"matched_count":  res.MatchedCount,
			"modified_count": res.ModifiedCount,
		}, nil

	case "deleteOne":
		res, err := coll.DeleteOne(ctx, filter)
		if err != nil {
			return nil, fmt.Errorf("mongodb: deleteOne: %w", err)
		}
		return map[string]interface{}{"deleted_count": res.DeletedCount}, nil

	case "deleteMany":
		res, err := coll.DeleteMany(ctx, filter)
		if err != nil {
			return nil, fmt.Errorf("mongodb: deleteMany: %w", err)
		}
		return map[string]interface{}{"deleted_count": res.DeletedCount}, nil

	case "countDocuments":
		count, err := coll.CountDocuments(ctx, filter)
		if err != nil {
			return nil, fmt.Errorf("mongodb: countDocuments: %w", err)
		}
		return map[string]interface{}{"count": count}, nil

	case "aggregate":
		pipeline, _ := config["pipeline"].([]interface{})
		cursor, err := coll.Aggregate(ctx, pipeline)
		if err != nil {
			return nil, fmt.Errorf("mongodb: aggregate: %w", err)
		}
		defer cursor.Close(ctx) //nolint:errcheck
		docs, err := decodeCursor(ctx, cursor)
		if err != nil {
			return nil, fmt.Errorf("mongodb: aggregate decode: %w", err)
		}
		return map[string]interface{}{"documents": docs, "count": len(docs)}, nil

	default:
		return nil, fmt.Errorf("mongodb: unknown operation %q — valid: find, findOne, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, countDocuments, aggregate", operation)
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func toBSON(v interface{}) bson.M {
	if m, ok := v.(map[string]interface{}); ok {
		return bson.M(m)
	}
	return bson.M{}
}

// wrapUpdate wraps a plain map in $set if it doesn't already have an operator key.
func wrapUpdate(v interface{}) interface{} {
	m, ok := v.(map[string]interface{})
	if !ok {
		return bson.M{}
	}
	for k := range m {
		if len(k) > 0 && k[0] == '$' {
			return bson.M(m)
		}
	}
	return bson.M{"$set": m}
}

func decodeCursor(ctx context.Context, cursor *mongo.Cursor) ([]map[string]interface{}, error) {
	var docs []map[string]interface{}
	for cursor.Next(ctx) {
		var raw bson.Raw
		if err := cursor.Decode(&raw); err != nil {
			return nil, err
		}
		doc, err := bsonRawToMap(raw)
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	if docs == nil {
		docs = []map[string]interface{}{}
	}
	return docs, nil
}

// bsonRawToMap converts a BSON raw document to a plain map via Extended JSON,
// ensuring MongoDB types (ObjectID, DateTime, etc.) serialize correctly to JSON.
func bsonRawToMap(raw bson.Raw) (map[string]interface{}, error) {
	extJSON, err := bson.MarshalExtJSON(raw, true, false)
	if err != nil {
		return nil, err
	}
	var m map[string]interface{}
	if err := json.Unmarshal(extJSON, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func toInt64(v interface{}) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case float64:
		return int64(n), true
	case int:
		return int64(n), true
	}
	return 0, false
}
