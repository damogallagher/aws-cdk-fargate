import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';

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
    const loadbalancer = new ApplicationLoadBalancer(this, `${props.envName}-lb`, {
      loadBalancerName: `${props.envName}-lb`,
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, `${props.envName}-Cluster`, {
      vpc,
      clusterName: `${props.envName}-fargate-cluster`,
    });

    //Execution role
    const executionRole = new iam.Role(this, `${props.envName}-ExecutionRole`, {
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
    });

    // Fargate Service
    new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `${props.envName}-FargateService`,
      {
        loadBalancerName: `${props.envName}-lb`,
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
          containerName: `${props.envName}-app-container`,
          family: `${props.envName}-fargate-task-defn`,
          containerPort: 80,
          executionRole,
        },
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 2,
        serviceName: `${props.envName}-fargate-service`,
        taskSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        loadBalancer: loadbalancer,
      }
    );
  }
}


