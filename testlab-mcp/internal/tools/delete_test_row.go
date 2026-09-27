// internal/tools/delete_test_row.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterDeleteTestRowTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("delete-test-row",
		mcp.WithDescription("Delete a single test row"),
		mcp.WithNumber("row_id", mcp.Required()),
	)

	handler := newDeleteTestRowHandler(c)
	s.AddTool(tool, handler.Handle)
}

type deleteTestRowHandler struct {
	client *client.Client
}

func newDeleteTestRowHandler(c *client.Client) *deleteTestRowHandler {
	return &deleteTestRowHandler{client: c}
}

func (h *deleteTestRowHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	rowID, err := req.RequireInt("row_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Delete(fmt.Sprintf("/tests/%d", rowID), nil)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
