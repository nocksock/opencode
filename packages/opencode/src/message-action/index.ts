import z from "zod"
import { Identifier } from "../id/id"
import { Session } from "../session"
import { Config } from "../config/config"
import { fn } from "../util/fn"
import { Log } from "../util/log"
import { spawn } from "child_process"

export namespace MessageAction {
  const log = Log.create({ service: "message-action" })

  export const Info = z
    .object({
      label: z.string(),
      description: z.string().optional(),
      command: z.string().array(),
      environment: z.record(z.string(), z.string()).optional(),
    })
    .meta({
      ref: "MessageActionInfo",
    })
  export type Info = z.infer<typeof Info>

  interface VariableContext {
    session_id: string
    message_id: string
    directory: string
    project_id: string
    session_title?: string
    parent_id?: string
  }

  /**
   * Substitute variables in a string using the provided context.
   * Supports both $var and ${var} syntax.
   * Only substitutes variables that are defined in the context - leaves unknown variables unchanged
   * for shell expansion. Does not substitute bash positional parameters ($1, $2, etc.) or special
   * variables ($@, $#, etc.)
   */
  function substituteVariables(text: string, context: VariableContext): string {
    let result = text

    // Replace ${var} syntax first (more specific)
    // Only match variable names (must start with letter or underscore)
    // Only replace if the variable exists in context
    result = result.replace(/\$\{([a-zA-Z_]\w*)\}/g, (match, key) => {
      const value = context[key as keyof VariableContext]
      return value !== undefined ? value : match
    })

    // Replace $var syntax (must come after ${var} to avoid conflicts)
    // Only match variable names (must start with letter or underscore)
    // Only replace if the variable exists in context
    result = result.replace(/\$([a-zA-Z_]\w*)/g, (match, key) => {
      const value = context[key as keyof VariableContext]
      return value !== undefined ? value : match
    })

    return result
  }

  export const ExecuteResult = z.object({
    success: z.boolean(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    error: z.string().optional(),
  })
  export type ExecuteResult = z.infer<typeof ExecuteResult>

  export async function list(): Promise<Info[]> {
    const config = await Config.get()
    return config.messageActions ?? []
  }

  export const execute = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      action: Info,
    }),
    async (input): Promise<ExecuteResult> => {
      log.info("execute", { sessionID: input.sessionID, messageID: input.messageID, label: input.action.label })

      try {
        // Get session to determine working directory and build context
        const session = await Session.get(input.sessionID)

        // Build variable context
        const context: VariableContext = {
          session_id: input.sessionID,
          message_id: input.messageID,
          directory: session.directory,
          project_id: session.projectID,
          session_title: session.title,
          parent_id: session.parentID,
        }

        // Substitute variables in command array
        const substitutedCommand = input.action.command.map((arg) => substituteVariables(arg, context))

        // Build command with session-id and message-id as trailing arguments (backward compatibility)
        const [command, ...args] = substitutedCommand
        const commandArgs = [...args, input.sessionID, input.messageID]

        // Substitute variables in environment variables
        const substitutedEnv = input.action.environment
          ? Object.fromEntries(
              Object.entries(input.action.environment).map(([key, value]) => {
                const substituted = substituteVariables(value, context)
                return [key, substituted]
              }),
            )
          : undefined

        // Execute command
        const result = await new Promise<ExecuteResult>((resolve) => {
          const proc = spawn(command, commandArgs, {
            cwd: session.directory,
            env: {
              ...process.env,
              ...substitutedEnv,
            },
          })

          let stdout = ""
          let stderr = ""

          proc.stdout?.on("data", (data) => {
            stdout += data.toString()
          })

          proc.stderr?.on("data", (data) => {
            stderr += data.toString()
          })

          proc.on("close", (code) => {
            resolve({
              success: code === 0,
              exitCode: code ?? -1,
              stdout,
              stderr,
            })
          })

          proc.on("error", (err) => {
            resolve({
              success: false,
              exitCode: -1,
              stdout,
              stderr,
              error: err.message,
            })
          })
        })

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error("execute failed", { error: errorMessage })
        return {
          success: false,
          exitCode: -1,
          stdout: "",
          stderr: "",
          error: errorMessage,
        }
      }
    },
  )
}
