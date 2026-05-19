package api

import "context"

type ctxKey string

const ctxUserID ctxKey = "userID"

func userIDFromCtx(ctx context.Context) string {
	id, _ := ctx.Value(ctxUserID).(string)
	return id
}
