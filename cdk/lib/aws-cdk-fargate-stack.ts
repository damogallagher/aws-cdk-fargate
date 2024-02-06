import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ApplicationListener, ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { ServiceConfig, emailServiceConfig, otherServiceConfig } from './config/service-config';
import { EnvironmentConfig, devEnvironmentConfig, prodEnvironmentConfig } from './config/environment-config';
import { LogDriver } from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';

interface MainCdkStackProps extends cdk.StackProps {
  envName: string;
}

export class AwsCdkFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainCdkStackProps) {
    super(scope, id, props);

    if (props.envName === "dev") {
      this.deployEnvironment(props, devEnvironmentConfig);
    } else if (props.envName === "prod") {
      this.deployEnvironment(props, prodEnvironmentConfig);
    }
  }
  deployEnvironment(props: MainCdkStackProps, environmentConfig: EnvironmentConfig) {
    const environmentName = props.envName;
    // VPC Setup
    const vpc = new ec2.Vpc(this, `${environmentName}-vpc`, {
      vpcName: `${environmentName}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${environmentName}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${environmentName}-private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Application load balancer
    const loadBalancer = new ApplicationLoadBalancer(this, `${environmentName}-lb`, {
      loadBalancerName: `${environmentName}-lb`,
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
    });

    const listener = loadBalancer.addListener(`${environmentName}-Listener`, {
      port: 80,
      open: true,
    });

    listener.addAction('DefaultAction', {
      action: ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Default Response',
      }),
    });


    // ECS Cluster
    const cluster = new ecs.Cluster(this, `${environmentName}-cluster`, {
      vpc,
      clusterName: `${environmentName}-fargate-cluster`,
    });

    //Execution role
    const executionRole = new iam.Role(this, `${environmentName}-executionRole`, {
      roleName: `${environmentName}-execution-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // ecr repository
    const repo = new ecr.Repository(this, `${environmentName}-repo`, {
      repositoryName: `${environmentName}-repository`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });


    const service1 = this.createFargateService(cluster, listener, executionRole, vpc, emailServiceConfig, props);
    const service2 = this.createFargateService(cluster, listener, executionRole, vpc, otherServiceConfig, props);

    // Output the endpoint of the application load balancer
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: loadBalancer.loadBalancerDnsName
    });

    this.createDatabases(vpc, environmentConfig, props)

  }
  private createFargateService(cluster: ecs.Cluster, listener: ApplicationListener, executionRole: iam.Role, vpc: ec2.Vpc, serviceConfig: ServiceConfig, props: MainCdkStackProps): ecs.FargateService {
    // Fargate Service
    // const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    //   this,
    //   `${environmentName}-${serviceName.toLowerCase()}-Service`,
    //   {
    //     loadBalancerName: `${environmentName}-${serviceName.toLowerCase()}-lb`,
    //     cluster,
    //     taskImageOptions: {
    //       image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
    //       containerName: `${environmentName}-app-container`,
    //       family: `${environmentName}-fargate-${serviceName}-task-defn`,
    //       containerPort: 80,
    //       executionRole,
    //     },
    //     cpu: 256,
    //     memoryLimitMiB: 512,
    //     desiredCount: 2,
    //     serviceName: `${environmentName}-fargate-${serviceName}-service`,
    //     taskSubnets: vpc.selectSubnets({
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     }),
    //     loadBalancer: loadBalancer,
    //   }
    // );
    const environmentName = props.envName;
    // Create a Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-task-definition`, {
      family: `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-task-definition`,
      executionRole,
    });

    // Define container image and other container configurations
    const container = taskDefinition.addContainer(`${environmentName}-${serviceConfig.serviceName.toLowerCase()}-app-container`, {
      containerName: `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-app-container`,
      image: ecs.ContainerImage.fromRegistry(serviceConfig.imageToDeploy), // Replace with your container image
      memoryLimitMiB: serviceConfig.memoryLimitMiB, // Specify the memory limit for the container
      cpu: serviceConfig.cpu, // Specify the CPU units for the container
      logging: LogDriver.awsLogs({ streamPrefix: 'FargateLogs' }),
    });

    // Expose a port on the container (if needed)
    container.addPortMappings({
      containerPort: serviceConfig.containerPortMapping,
    });


    // Create a Fargate service
    const fargateService = new ecs.FargateService(this, `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-fargate-service`, {
      serviceName: `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-service`,
      cluster,
      taskDefinition,
      desiredCount: serviceConfig.desiredCount, // Specify the number of tasks to run
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    // Create a target group
    const targetGroup = new ApplicationTargetGroup(this, `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-tg`, {
      targetGroupName: `${environmentName}-${serviceConfig.serviceName.toLowerCase()}-tg`,
      vpc,
      port: serviceConfig.targetGroupPortMapping, // Specify the port for your target group
      targetType: TargetType.IP, // Specify the target type (IP or Instance)
      healthCheck: {
        path: '/', // Specify the health check path
        interval: cdk.Duration.seconds(serviceConfig.healthCheckInterval), // Specify the health check interval
        timeout: cdk.Duration.seconds(serviceConfig.healthCheckTimeout), // Specify the health check timeout
      },

    });

    // Associate the Fargate service with the target group
    targetGroup.addTarget(fargateService);

    listener.addAction(`forward-to-${serviceConfig.serviceName}-target-group`, {
      action: ListenerAction.forward([targetGroup], {}),
      conditions: [ListenerCondition.pathPatterns([`/${serviceConfig.servicePath}`, `/${serviceConfig.servicePath}/*`])], // Path-based routing rule for TargetGroupA
      priority: serviceConfig.rulePriority
    })


    return fargateService;
  }
  private createDatabases(vpc: ec2.Vpc, environmentConfig: EnvironmentConfig, props: MainCdkStackProps): void {
    const environmentName = props.envName;
    // Define a PostgreSQL instance
    const postgresInstance = new rds.DatabaseInstance(this, `${environmentName}-db-microservices`, {
      instanceIdentifier: `${environmentName}-db-microservices`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_6,
      }),
      instanceType: new ec2.InstanceType(environmentConfig.postgresDBInstanceType),
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      allocatedStorage: environmentConfig.postgresDBAllocatedStorage, // Specify the storage size in GB
      deletionProtection: true, // Change to true if you want to enable deletion protection
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Change to RETAIN if you want to retain the database on stack deletion
      credentials: rds.Credentials.fromGeneratedSecret(environmentConfig.postgresDBMasterUsername), // Specify the master username (default is 'admin')
      port: environmentConfig.postgresDBPort, // PostgreSQL default port
    });

    // Define a SQL Server Express instance
    const sqlServerInstance = new rds.DatabaseInstance(this, `${environmentName}-umbracodb`, {
      instanceIdentifier: `${environmentName}-umbracodb`,
      engine: rds.DatabaseInstanceEngine.sqlServerEx({
        version: rds.SqlServerEngineVersion.VER_15_00_4236_7_V1,
      }),
      instanceType: new ec2.InstanceType(environmentConfig.sqlServerDBInstanceType),
      vpc: vpc, // Replace <YourVpcHere> with your VPC
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      allocatedStorage: 20, // Specify the storage size in GB
      deletionProtection: true, // Change to true if you want to enable deletion protection
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Change to RETAIN if you want to retain the database on stack deletion
      credentials: rds.Credentials.fromGeneratedSecret(environmentConfig.sqlServerDBMasterUsername), // Specify the master username (default is 'admin')
      port: environmentConfig.sqlServerDBPort, // SQL Server default port
    });

    // Output the endpoint address of the PostgreSQL instance
    new cdk.CfnOutput(this, `${environmentName}-db-microservices-PostgresEndpoint`, {
      value: postgresInstance.instanceEndpoint.hostname,
    });

    // Output the endpoint address of the SQL Server instance
    new cdk.CfnOutput(this, 'SqlServerEndpoint', {
      value: sqlServerInstance.instanceEndpoint.hostname,
    });

  }
}


