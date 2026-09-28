// internal/tools/list_test_rows.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterListTestRowsTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("list-test-rows",
		mcp.WithDescription("List all test rows belonging to a suite"),
		mcp.WithNumber("suite_id", mcp.Required()),
	)

	handler := newListTestRowsHandler(c)
	s.AddTool(tool, handler.Handle)
}

type listTestRowsHandler struct {
	client *client.Client
}

func newListTestRowsHandler(c *client.Client) *listTestRowsHandler {
	return &listTestRowsHandler{client: c}
}

func (h *listTestRowsHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Get(ctx, fmt.Sprintf("/tests/%d", suiteID))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
