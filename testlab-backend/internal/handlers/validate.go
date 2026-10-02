package handlers

import "strings"

// Values accepted by the test_status and access_scope Postgres enums. Checking
// them here turns a bad value into a 400 instead of a database error.
var (
	validTestStatuses = map[string]bool{"untested": true, "in_progress": true, "passed": true, "failed": true}
	validAccessScopes = map[string]bool{"read": true, "write": true, "admin": true}
)

func isValidHTTPStatus(code int) bool {
	return code >= 100 && code <= 599
}

func isBlank(s string) bool {
	return strings.TrimSpace(s) == ""
}
