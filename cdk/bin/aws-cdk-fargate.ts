#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsCdkFargateStack } from '../lib/aws-cdk-fargate-stack';

//See https://docs.aws.amazon.com/cdk/v2/guide/stack_how_to_create_multiple_stacks.html
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
