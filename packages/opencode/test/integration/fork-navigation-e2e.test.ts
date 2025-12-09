import { describe, test, expect } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Storage } from "@/storage/storage"
import { tmpdir } from "../fixture/fixture"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"

describe("Fork Command Navigation E2E", () => {
  test("should fork session via SDK and return new session immediately", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create original session
        const originalSession = await Session.create({})
        await Storage.write(["session", Instance.project.id, originalSession.id], originalSession)

        // Start server and create SDK client
        const { Server } = await import("@/server/server")
        const port = Math.floor(Math.random() * 10000) + 10000
        const server = Server.listen({ port, hostname: "127.0.0.1" })

        try {
          const sdk = await createOpencode({
            port,
            hostname: "127.0.0.1",
          })

          // Call session.fork() directly (mimicking TUI behavior)
          const startTime = Date.now()
          const forkResult = await sdk.client.session.fork({
            path: { sessionID: originalSession.id },
            body: {},
          })
          const forkDuration = Date.now() - startTime

          // Verify fork returns immediately (should be fast)
          expect(forkDuration).toBeLessThan(1000) // Less than 1 second

          // Verify forked session exists
          expect(forkResult.data).toBeDefined()
          expect(forkResult.data!.id).not.toBe(originalSession.id)
          expect(forkResult.data!.parentID).toBe(originalSession.id)

          const forkedSessionID = forkResult.data!.id

          // Verify the forked session exists and is empty
          const messages = await Session.messages({ sessionID: forkedSessionID })
          expect(messages.length).toBe(0)

          // Now send a message to the forked session (mimicking TUI sending /fork arguments)
          await sdk.client.session.prompt({
            path: { sessionID: forkedSessionID },
            body: {
              agent: "build",
              model: {
                providerID: "anthropic",
                modelID: "claude-sonnet-4-20250514",
              },
              parts: [
                {
                  type: "text",
                  text: "Continue with this approach",
                },
              ],
            },
          })

          // Verify message was added to forked session
          const forkedMessages = await Session.messages({ sessionID: forkedSessionID })
          expect(forkedMessages.length).toBeGreaterThan(0)

          // Verify the message is in the forked session
          const userMessage = forkedMessages.find((m) => m.info.role === "user")
          expect(userMessage).toBeDefined()

          sdk.server.close()
        } finally {
          server.stop()
        }
      },
    })
  })

  test("should handle multiple sequential forks", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create original session
        const originalSession = await Session.create({})
        await Storage.write(["session", Instance.project.id, originalSession.id], originalSession)

        const { Server } = await import("@/server/server")
        const port = Math.floor(Math.random() * 10000) + 10000
        const server = Server.listen({ port, hostname: "127.0.0.1" })

        try {
          const sdk = await createOpencode({
            port,
            hostname: "127.0.0.1",
          })

          // Fork first time
          const fork1 = await sdk.client.session.fork({
            path: { sessionID: originalSession.id },
            body: {},
          })

          expect(fork1.data!.parentID).toBe(originalSession.id)

          // Fork second time from original (not from fork1)
          const fork2 = await sdk.client.session.fork({
            path: { sessionID: originalSession.id },
            body: {},
          })

          expect(fork2.data!.parentID).toBe(originalSession.id)
          expect(fork2.data!.id).not.toBe(fork1.data!.id)

          // Fork from fork1 (nested fork)
          const fork3 = await sdk.client.session.fork({
            path: { sessionID: fork1.data!.id },
            body: {},
          })

          expect(fork3.data!.parentID).toBe(fork1.data!.id)

          sdk.server.close()
        } finally {
          server.stop()
        }
      },
    })
  })
})
