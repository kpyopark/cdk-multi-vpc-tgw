# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Prerequsite
 * Install aws-cdk & @aws-cdk/ec2 & @aws-cdk/aws-elasticloadbalancingv2
 * `npm install --save-data aws-cdk`         install aws-cdk
 * `npm install --save-data @aws-cdk/aws-ec2`    install @aws-cdk/ec2 (which supports EC2instance and VPC classes)
 * `npm install --save-data @aws-cdk/aws-elasticloadbalancingv2`    which supports ELB classes.
 * `npm install --save-data @aws-cdk/aws-appstream`   install @aws-cdk/aws-appstream for appstream
 * Configure environment variable keypair used in the initialization of EC2.
 * `export keypair=<your ec2 keypair name>`


## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
