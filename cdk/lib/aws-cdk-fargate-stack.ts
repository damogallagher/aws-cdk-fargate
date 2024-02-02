import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ApplicationListener, ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { ServiceConfig, emailServiceConfig, otherServiceConfig } from './environment-config';
import { LogDriver } from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

interface MainCdkStackProps extends cdk.StackProps {
  envName: string;
}

export class AwsCdkFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainCdkStackProps) {
    super(scope, id, props);

    if (props.envName === "dev") {
      this.deployEnvironment(props);
    } else if (props.envName === "prod") {
      this.deployEnvironment(props);
    }
  }
  deployEnvironment(props: MainCdkStackProps) {
    const environmentName = props.envName;
    // VPC Setup
    const vpc = new ec2.Vpc(this, `${props.envName}-vpc`, {
      vpcName: `${props.envName}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${props.envName}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${props.envName}-private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Application load balancer
    const loadBalancer = new ApplicationLoadBalancer(this, `${props.envName}-lb`, {
      loadBalancerName: `${props.envName}-lb`,
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
    });

    const listener = loadBalancer.addListener(`${props.envName}-Listener`, {
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
    const cluster = new ecs.Cluster(this, `${props.envName}-cluster`, {
      vpc,
      clusterName: `${props.envName}-fargate-cluster`,
    });

    //Execution role
    const executionRole = new iam.Role(this, `${props.envName}-executionRole`, {
      roleName: `${props.envName}-execution-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // ecr repository
    const repo = new ecr.Repository(this, `${props.envName}-repo`, {
      repositoryName: `${props.envName}-repository`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

 
    const service1 = this.createFargateService(cluster, listener, executionRole, vpc, emailServiceConfig, props);
    const service2 = this.createFargateService(cluster, listener, executionRole, vpc, otherServiceConfig, props);
  }
  private createFargateService(cluster: ecs.Cluster, listener: ApplicationListener, executionRole: iam.Role, vpc: ec2.Vpc, serviceConfig: ServiceConfig, props: MainCdkStackProps): ecs.FargateService {
    // Fargate Service
    // const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    //   this,
    //   `${props.envName}-${serviceName.toLowerCase()}-Service`,
    //   {
    //     loadBalancerName: `${props.envName}-${serviceName.toLowerCase()}-lb`,
    //     cluster,
    //     taskImageOptions: {
    //       image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
    //       containerName: `${props.envName}-app-container`,
    //       family: `${props.envName}-fargate-${serviceName}-task-defn`,
    //       containerPort: 80,
    //       executionRole,
    //     },
    //     cpu: 256,
    //     memoryLimitMiB: 512,
    //     desiredCount: 2,
    //     serviceName: `${props.envName}-fargate-${serviceName}-service`,
    //     taskSubnets: vpc.selectSubnets({
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     }),
    //     loadBalancer: loadBalancer,
    //   }
    // );

    // Create a Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-task-definition`, {
      family: `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-task-definition`,
      executionRole,
    });

    // Define container image and other container configurations
    const container = taskDefinition.addContainer(`${props.envName}-${serviceConfig.serviceName.toLowerCase()}-app-container`, {
      containerName: `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-app-container`,
      image: ecs.ContainerImage.fromRegistry(serviceConfig.imageToDeploy), // Replace with your container image
      memoryLimitMiB: serviceConfig.memoryLimitMiB, // Specify the memory limit for the container
      cpu: serviceConfig.cpu, // Specify the CPU units for the container
      logging: LogDriver.awsLogs({streamPrefix: 'FargateLogs'}),
    });

    // Expose a port on the container (if needed)
    container.addPortMappings({
      containerPort: serviceConfig.containerPortMapping,
    });


    // Create a Fargate service
    const fargateService = new ecs.FargateService(this, `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-fargate-service`, {
      serviceName: `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-service`,
      cluster,
      taskDefinition,
      desiredCount: serviceConfig.desiredCount, // Specify the number of tasks to run
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    // Create a target group
    const targetGroup = new ApplicationTargetGroup(this, `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-tg`, {
      targetGroupName: `${props.envName}-${serviceConfig.serviceName.toLowerCase()}-tg`,
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
}


