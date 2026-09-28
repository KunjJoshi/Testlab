// internal/tools/patch_helper.go
package tools

func buildPatchBody(args map[string]any, fields ...string) map[string]any {
	body := map[string]any{}
	for _, field := range fields {
		if v, ok := args[field]; ok {
			body[field] = v
		}
	}
	return body
}
