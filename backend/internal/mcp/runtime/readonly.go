package runtime

import "context"

type contextKey string

const readOnlyKey contextKey = "read_only"

func WithReadOnly(ctx context.Context) context.Context {
	return context.WithValue(ctx, readOnlyKey, true)
}

func IsReadOnly(ctx context.Context) bool {
	v, _ := ctx.Value(readOnlyKey).(bool)
	return v
}
