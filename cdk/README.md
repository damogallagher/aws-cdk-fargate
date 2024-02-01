# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

See https://docs.aws.amazon.com/cdk/v2/guide/ecs_example.html and  https://www.cloudtechsimplified.com/ci-cd-pipeline-aws-fargate-github-actions-nodejs/
## Steps locally
cdk bootstrap --profile damiensandbox-ergo
cdk deploy DevStack --profile damiensandbox-ergo
cdk deploy ProdStack --profile damiensandbox-ergo
cdk destroy --profile damiensandbox-ergo

cloudformation to terraform - see https://discuss.hashicorp.com/t/tool-to-convert-cloudformation-to-terraform/46704
pip install cf2tf
cf2tf AwsCdkFargateStack.template.json 