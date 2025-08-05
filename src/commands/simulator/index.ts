import { Command } from 'commander';
import { startCommand } from './start';
import { stopCommand } from './stop';
import { isSimulatorRunning, getSimulatorPid, getSimulatorEndpoint } from '@/src/utils/simulator';

const simulatorCommands = new Command()
  .name('simulator')
  .description('TEE simulator commands')
  .addCommand(startCommand)
  .addCommand(stopCommand);

// Add default action to show status when no subcommand is provided
simulatorCommands.action(async () => {
  try {
    const isRunning = await isSimulatorRunning();
    const pid = getSimulatorPid();
    
    if (isRunning && pid) {
      const endpoint = getSimulatorEndpoint();
      const dstackEndpoint = getSimulatorEndpoint();
      const tappdEndpoint = dstackEndpoint.replace(/dstack\.sock$/, 'tappd.sock');
      
      console.log(`✓ TEE simulator is running (PID: ${pid})`);
      console.log('\nSet these environment variables to use the simulator:');
      console.log(`  export DSTACK_SIMULATOR_ENDPOINT=${dstackEndpoint}`);
      console.log(`  export TAPPD_SIMULATOR_ENDPOINT=${tappdEndpoint}`);
    } else {
      console.log('TEE simulator is not running');
      console.log('\nTo start the simulator, run:');
      console.log('  phala simulator start');
    }
  } catch (error) {
    console.error('Error checking simulator status:', error);
  }
});

export { simulatorCommands };

