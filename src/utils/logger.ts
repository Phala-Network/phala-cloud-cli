import chalk from "chalk"

export const logger = {
  error: (message: string, ...args: any[]) => {
    console.error(chalk.red('✗'), chalk.red(message), ...args)
  },
  warn: (message: string, ...args: any[]) => {
    console.log(chalk.yellow('⚠'), chalk.yellow(message), ...args)
  },
  info: (message: string, ...args: any[]) => {
    console.log(chalk.blue('ℹ'), chalk.blue(message), ...args)
  },
  success: (message: string, ...args: any[]) => {
    console.log(chalk.green('✓'), chalk.green(message), ...args)
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), chalk.gray(message), ...args)
    }
  },
  table: (data: any[], columns?: string[]) => {
    if (data.length === 0) {
      console.log(chalk.yellow('No data to display'))
      return
    }
    
    if (columns) {
      // Filter data to only include specified columns
      data = data.map(item => {
        const filtered: any = {}
        columns.forEach(col => {
          filtered[col] = item[col]
        })
        return filtered
      })
    }
    
    console.table(data)
  },
  startSpinner: (message: string) => {
    process.stdout.write(`${chalk.blue('⟳')} ${message}... `)
    return {
      stop: (success = true, result?: string) => {
        const icon = success ? chalk.green('✓') : chalk.red('✗')
        const resultText = result ? `: ${result}` : ''
        console.log(`${icon}${resultText}`)
      }
    }
  },
  break() {
    console.log("")
  },
}

