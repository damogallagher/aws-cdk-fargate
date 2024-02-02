
export interface ServiceConfig {
    serviceName: string;
    servicePath: string;
    rulePriority: number;
    imageToDeploy: string;
    containerPortMapping: number;
    memoryLimitMiB: number;
    cpu: number; 
    desiredCount: number;
    targetGroupPortMapping: number;
    healthCheckInterval: number;
    healthCheckTimeout: number;
}


export const emailServiceConfig: ServiceConfig = {
    serviceName: 'EmailService',
    servicePath: 'EmailService',
    rulePriority: 10,
    imageToDeploy: 'amazon/amazon-ecs-sample',
    containerPortMapping: 80,
    memoryLimitMiB: 512, 
    cpu: 256, 
    desiredCount: 2,
    targetGroupPortMapping: 80,
    healthCheckInterval: 30,
    healthCheckTimeout: 10,
};

export const otherServiceConfig: ServiceConfig = {
    serviceName: 'OtherService',
    servicePath: 'OtherService',
    rulePriority: 20,
    imageToDeploy: 'nginx:latest',
    containerPortMapping: 80,
    memoryLimitMiB: 512, 
    cpu: 256, 
    desiredCount: 2,
    targetGroupPortMapping: 80,
    healthCheckInterval: 30,
    healthCheckTimeout: 10,
};