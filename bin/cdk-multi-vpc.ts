#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkMultiVpcStack } from '../lib/cdk-multi-vpc-stack';

const app = new cdk.App();
new CdkMultiVpcStack(app, 'CdkMultiVpcStack');
