// internal/tools/list_users_with_access.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterListUsersWithAccessTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("list-users-with-access",
		mcp.WithDescription("List everyone who has been granted access to a test suite"),
		mcp.WithNumber("suite_id", mcp.Required()),
	)

	handler := newListUsersWithAccessHandler(c)
	s.AddTool(tool, handler.Handle)
}

type listUsersWithAccessHandler struct {
	client *client.Client
}

func newListUsersWithAccessHandler(c *client.Client) *listUsersWithAccessHandler {
	return &listUsersWithAccessHandler{client: c}
}

func (h *listUsersWithAccessHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Get(ctx, fmt.Sprintf("/access/list-users/%d", suiteID))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
