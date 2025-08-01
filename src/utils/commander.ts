import { Command } from 'commander';

// Extend Command type to include our custom properties
declare module 'commander' {
  interface Command {
    _result?: any;
    _error?: Error;
  }
}

// Helper function to set command result
export function setCommandResult(command: Command, result: any) {
  (command as any)._result = result;
  return result;
}

// Helper function to set command error
export function setCommandError(command: Command, error: Error) {
  (command as any)._error = error;
  return error;
}

// Helper function to get command result
export function getCommandResult<T = any>(command: Command): T | undefined {
  return (command as any)._result;
}

// Helper function to get command error
export function getCommandError(command: Command): Error | undefined {
  return (command as any)._error;
}
