import { describe, test, expect } from "bun:test"
import { Config } from "@/config/config"

describe("MessageAction Config Schema", () => {
  test("should validate valid messageActions config", () => {
    const config = {
      messageActions: [
        {
          command: ["script.sh", "arg1"],
          label: "Test Action",
          description: "A test action",
          environment: { KEY: "value" },
        },
      ],
    }

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(true)
  })

  test("should allow messageActions with minimal fields", () => {
    const config = {
      messageActions: [
        {
          command: ["script.sh"],
          label: "Minimal Action",
        },
      ],
    }

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(true)
  })

  test("should reject messageActions without required fields", () => {
    const config = {
      messageActions: [
        {
          command: ["script.sh"],
          // missing label
        },
      ],
    }

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(false)
  })

  test("should reject messageActions with empty command array", () => {
    const config = {
      messageActions: [
        {
          command: [],
          label: "Empty Command",
        },
      ],
    }

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(false)
  })

  test("should handle missing messageActions field", () => {
    const config = {}

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(true)
  })

  test("should reject invalid environment variable types", () => {
    const config = {
      messageActions: [
        {
          command: ["script.sh"],
          label: "Bad Env",
          environment: { KEY: 123 },
        },
      ],
    }

    const result = Config.Info.safeParse(config)
    expect(result.success).toBe(false)
  })
})
