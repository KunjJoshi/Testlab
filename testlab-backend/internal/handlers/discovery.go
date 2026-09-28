package handlers

import (
	"encoding/json"
	"net/http"
)

type DiscoveryHandler struct {
	IssuerURL string
}

type AuthServerMetadata struct {
	Issuer                            string   `json:"issuer"`
	AuthEndpoint                      string   `json:"authorization_endpoint"`
	TokenEndpoint                     string   `json:"token_endpoint"`
	ResponseTypesSupported            []string `json:"response_types_supported"`
	GrantTypeSupported                []string `json:"grant_types_supported"`
	CodeChallengeMethodSupported      []string `json:"code_challenge_methods_supported"`
	TokenEndpointAuthMethodSupported  []string `json:"token_endpoint_auth_methods_supported"`
	ClientIDMetadataDocumentSupported bool     `json:"client_id_metadata_document_supported"`
}

func (h *DiscoveryHandler) GetAuthServerMetadata(w http.ResponseWriter, r *http.Request) {
	metadata := buildAuthServerMetadata(h.IssuerURL)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metadata)
}

func buildAuthServerMetadata(issuerURL string) AuthServerMetadata {
	return AuthServerMetadata{
		Issuer:                            issuerURL,
		AuthEndpoint:                      issuerURL + "/authorize",
		TokenEndpoint:                     issuerURL + "/token",
		ResponseTypesSupported:            []string{"code"},
		GrantTypeSupported:                []string{"authorization_code"},
		CodeChallengeMethodSupported:      []string{"S256"},
		TokenEndpointAuthMethodSupported:  []string{"none"},
		ClientIDMetadataDocumentSupported: true,
	}
}
