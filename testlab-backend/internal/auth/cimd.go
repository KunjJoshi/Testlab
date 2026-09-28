package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type ClientMetadata struct {
	ClientID                string   `json:"client_id"`
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
}

const (
	cimdFetchTimeout = 5 * time.Second
	cimdMaxBodyBytes = 1 << 16
	cimdCacheTTL     = 1 * time.Hour
)

type cimdCacheEntry struct {
	metadata  *ClientMetadata
	expiresAt time.Time
}

type CIMDCache struct {
	mu      sync.Mutex
	entries map[string]cimdCacheEntry
}

func NewCIMDCache() *CIMDCache {
	return &CIMDCache{entries: make(map[string]cimdCacheEntry)}
}

func (c *CIMDCache) Get(clientID string) (*ClientMetadata, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[clientID]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}

	return entry.metadata, true
}

func (c *CIMDCache) Set(clientID string, metadata *ClientMetadata) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[clientID] = cimdCacheEntry{metadata: metadata, expiresAt: time.Now().Add(cimdCacheTTL)}
}

var cimdCacheClient = &http.Client{
	Timeout: cimdFetchTimeout,
	Transport: &http.Transport{
		DialContext: safeDialContext,
	},
	CheckRedirect: rejectRedirect,
}

func rejectRedirect(req *http.Request, via []*http.Request) error {
	return http.ErrUseLastResponse
}

func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, err
	}

	if err := rejectBlockedIPs(ips); err != nil {
		return nil, err
	}

	dialer := &net.Dialer{}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

func rejectBlockedIPs(ips []net.IP) error {
	for _, ip := range ips {
		if isBlockedIP(ip) {
			return fmt.Errorf("refusing to connect to disallowed address: %s", ip.String())
		}
	}
	return nil
}

func isBlockedIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

func FetchClientMetadata(cache *CIMDCache, clientID string) (*ClientMetadata, error) {
	if cached, ok := cache.Get(clientID); ok {
		return cached, nil
	}

	if err := validateClientIDURL(clientID); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodGet, clientID, nil)
	if err != nil {
		return nil, err
	}

	resp, err := cimdCacheClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch client metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("client metadata endpoint returned status %d", resp.StatusCode)
	}

	limitedBody := io.LimitReader(resp.Body, cimdMaxBodyBytes)

	var metadata ClientMetadata
	if err := json.NewDecoder(limitedBody).Decode(&metadata); err != nil {
		return nil, fmt.Errorf("failed to parse client metadata: %w", err)
	}

	if metadata.ClientID != clientID {
		return nil, errors.New("client metadata document's client_id does not match the fetched URL")
	}

	cache.Set(clientID, &metadata)
	return &metadata, nil
}

func validateClientIDURL(clientID string) error {
	parsed, err := url.Parse(clientID)
	if err != nil {
		return fmt.Errorf("client_id is not a valid URL: %w", err)
	}
	if parsed.Scheme != "https" {
		return errors.New("client_id must be an HTTPS URL")
	}
	return nil
}

func IsRedirectURIAllowed(metadata *ClientMetadata, redirectURI string) bool {
	for _, allowed := range metadata.RedirectURIs {
		if allowed == redirectURI {
			return true
		}
		if isLoopbackRedirectMatch(allowed, redirectURI) {
			return true
		}
	}
	return false
}

func isLoopbackRedirectMatch(registered, requested string) bool {

	registeredURL, err := url.Parse(registered)
	if err != nil {
		return false
	}

	requestedURL, err := url.Parse(requested)
	if err != nil {
		return false
	}

	if !isLoopbackHost(registeredURL.Hostname()) || !isLoopbackHost(requestedURL.Hostname()) {
		return false
	}

	return registeredURL.Scheme == requestedURL.Scheme &&
		registeredURL.Hostname() == requestedURL.Hostname() &&
		registeredURL.Path == requestedURL.Path
}

func isLoopbackHost(host string) bool {
	return host == "127.0.0.1" || host == "::1" || host == "localhost"
}
