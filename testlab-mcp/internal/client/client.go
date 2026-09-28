package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/KunjJoshi/testlab-mcp/internal/auth"
)

type Client struct {
	BaseURL string
	Token   string
}

func (c *Client) do(ctx context.Context, method, path string, body any) ([]byte, error) {

	token, _ := auth.TokenFromContext(ctx)
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("backend returned %d: %s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}

func (c *Client) Post(ctx context.Context, path string, body any) ([]byte, error) {
	return c.do(ctx, "POST", path, body)
}
func (c *Client) Get(ctx context.Context, path string) ([]byte, error) {
	return c.do(ctx, "GET", path, nil)
}
func (c *Client) Patch(ctx context.Context, path string, body any) ([]byte, error) {
	return c.do(ctx, "PATCH", path, body)
}
func (c *Client) Delete(ctx context.Context, path string, body any) ([]byte, error) {
	return c.do(ctx, "DELETE", path, body)
}
