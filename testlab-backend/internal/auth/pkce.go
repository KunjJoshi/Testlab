package auth

import (
	"crypto/sha256"
	"encoding/base64"
)

func VerifyPKCE(codeVerifier, codeChallenge string) bool {
	hash := sha256.Sum256([]byte(codeVerifier))
	computed := base64.RawURLEncoding.EncodeToString(hash[:])
	return computed == codeChallenge
}
