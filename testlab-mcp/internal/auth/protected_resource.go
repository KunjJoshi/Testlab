// internal/auth/protected_resource.go
package auth

import (
	"encoding/json"
	"net/http"
	"os"
)

type ProtectedResourceMetadataResponse struct {
	Resource             string   `json:"resource"`
	AuthorizationServers []string `json:"authorization_servers"`
}

func ProtectedResourceMetadata(w http.ResponseWriter, r *http.Request) {
	metadata := buildProtectedResourceMetadata()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metadata)
}

func buildProtectedResourceMetadata() ProtectedResourceMetadataResponse {
	return ProtectedResourceMetadataResponse{
		Resource:             os.Getenv("MCP_SELF_URL"),
		AuthorizationServers: []string{os.Getenv("TESTLAB_BACKEND_URL")},
	}
}
