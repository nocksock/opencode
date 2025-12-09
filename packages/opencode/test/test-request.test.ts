import { describe, test, expect } from "bun:test"

describe("Test Request Handler", () => {
  test("should handle 'This is a test' request correctly", async () => {
    // When user says "This is a test"
    const input = "This is a test"

    // System should recognize it as a test request
    const isTestRequest = recognizeTestRequest(input)

    // And respond appropriately
    expect(isTestRequest).toBe(true)
  })
})

function recognizeTestRequest(input: string): boolean {
  // Minimal implementation: check if input contains "test"
  return input.toLowerCase().includes("test")
}
