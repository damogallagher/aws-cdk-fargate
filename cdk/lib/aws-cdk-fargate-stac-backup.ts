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
    const vpc = new ec2.Vpc(this, `${environmentName}-FargateNodeJsVpc`, {
      vpcName: `${environmentName}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${environmentName}-public-subnet`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${environmentName}-private-subnet`,
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

    // ECS Cluster
    const cluster = new ecs.Cluster(this, `${environmentName}-Cluster`, {
      vpc,
      clusterName: `${environmentName}-fargate-node-cluster`,
    });

    //Execution role
    const executionRole = new iam.Role(this, `${environmentName}-ExecutionRole`, {
      roleName: `${environmentName}-execution-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // ecr repository
    const repo = new ecr.Repository(this, `${environmentName}-Repo`, {
      repositoryName: `${environmentName}-fargate-nodejs-app`,
    });

    // Fargate Service
    new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `${environmentName}-FargateNodeService`,
      {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
          containerName: `${environmentName}-nodejs-app-container`,
          family: `${environmentName}-fargate-node-task-defn`,
          //containerPort: 3000,
          containerPort: 80,
          executionRole,
        },
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 2,
        serviceName: `${environmentName}-fargate-node-service`,
        taskSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
        loadBalancer,
      }
    );
  }

}


const app = new cdk.App();

// Define the environments
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'eu-west-1', // Change this to your desired dev region
};

const prodEnv = {
  account: 'process.env.CDK_DEFAULT_ACCOUNT',
  region: 'eu-west-1', // Change this to your desired prod region
};

// Instantiate the stack for dev environment
new AwsCdkFargateStack(app, 'DevStack', { env: devEnv, envName: 'dev' });

// Instantiate the stack for prod environment
new AwsCdkFargateStack(app, 'ProdStack', { env: prodEnv, envName: 'prod' });

// Synthesize and deploy the stacks
app.synth();