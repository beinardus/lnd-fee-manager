import { exec } from 'child_process';
import logger from "./winston-plugin.js";

const UPDATE_CMD = process.env.UPDATE_CMD || 'run-charge';

const execPromise = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error)
            }
            resolve(stderr || stdout);
        });
    });
};

const exportFees = async () => {
    try {
        logger.info(await execPromise(UPDATE_CMD));
    }
    catch (e) {
        logger.error(`exportFee cmd: <${UPDATE_CMD}>`, e);
    }
};

export default exportFees;