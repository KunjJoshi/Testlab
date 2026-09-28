// internal/tools/provide_access.go
package tools

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterProvideAccessTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("provide-access",
		mcp.WithDescription("Grant a user access to a test suite"),
		mcp.WithNumber("user_id", mcp.Required(), mcp.Description("The user to grant access to")),
		mcp.WithNumber("suite_id", mcp.Required()),
		mcp.WithString("access_scope", mcp.Required(), mcp.Description("read, write, or admin")),
	)

	handler := newProvideAccessHandler(c)
	s.AddTool(tool, handler.Handle)
}

type provideAccessHandler struct {
	client *client.Client
}

func newProvideAccessHandler(c *client.Client) *provideAccessHandler {
	return &provideAccessHandler{client: c}
}

func (h *provideAccessHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := req.RequireInt("user_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	accessScope, err := req.RequireString("access_scope")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{
		"user_id":      userID,
		"suite_id":     suiteID,
		"access_scope": accessScope,
	}

	resp, err := h.client.Post(ctx, "/access/provide", body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}

func RegisterUpdateAccessTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("update-access",
		mcp.WithDescription("Change a user's access scope on a test suite"),
		mcp.WithNumber("user_id", mcp.Required()),
		mcp.WithNumber("suite_id", mcp.Required()),
		mcp.WithString("access_scope", mcp.Required(), mcp.Description("read, write, or admin")),
	)

	handler := newUpdateAccessHandler(c)
	s.AddTool(tool, handler.Handle)
}

type updateAccessHandler struct {
	client *client.Client
}

func newUpdateAccessHandler(c *client.Client) *updateAccessHandler {
	return &updateAccessHandler{client: c}
}

func (h *updateAccessHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := req.RequireInt("user_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	accessScope, err := req.RequireString("access_scope")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{
		"user_id":      userID,
		"suite_id":     suiteID,
		"access_scope": accessScope,
	}

	resp, err := h.client.Patch(ctx, "/access/update-access", body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}

func RegisterRemoveAccessTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("remove-access",
		mcp.WithDescription("Revoke a user's access to a test suite entirely"),
		mcp.WithNumber("user_id", mcp.Required()),
		mcp.WithNumber("suite_id", mcp.Required()),
	)

	handler := newRemoveAccessHandler(c)
	s.AddTool(tool, handler.Handle)
}

type removeAccessHandler struct {
	client *client.Client
}

func newRemoveAccessHandler(c *client.Client) *removeAccessHandler {
	return &removeAccessHandler{client: c}
}

func (h *removeAccessHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := req.RequireInt("user_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{
		"user_id":  userID,
		"suite_id": suiteID,
	}

	resp, err := h.client.Delete(ctx, "/access/remove-user", body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
