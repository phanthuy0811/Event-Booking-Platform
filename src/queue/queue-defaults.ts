import { JobsOptions } from 'bullmq';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
    attempts: 5,
    backoff: {
        type: 'exponential',
        delay: 1000,
    },
    removeOnComplete: {
        age: 3600,
        count: 1000,
    },
    removeOnFail: {
        age: 604800,
    },
};

export const NON_RETRYABLE_JOB_OPTIONS: JobsOptions = {
    ...DEFAULT_JOB_OPTIONS,
    attempts: 1,
};
