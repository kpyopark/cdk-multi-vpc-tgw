import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import as = require('@aws-cdk/aws-appstream');

import { truncate } from "fs";

const vpcenv = process.env.vpcenv === undefined ? "test" : process.env.vpcenv;
const corp =
  process.env.corpname === undefined ? "samcorp" : process.env.corpname;
const servicename =
  process.env.servicename === undefined ? "tgwtest" : process.env.servicename;
const elemPrefix = `${vpcenv}-${corp}-${servicename}`;
const ec2keypair =
  process.env.keypair === undefined ? "sample_keypair" : process.env.keypair;

export class CdkMultiVpcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // https://stackoverflow.com/questions/21122342/how-to-clean-node-modules-folder-of-packages-that-are-not-in-package-json
    // Sometimes, the below 'this' instance might show errors cause of recusively installed node_modules in AWS CDK.
    // At that time, you can use below command in bash shell './node_modules'
    // find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \;
    // The code that defines your stack goes here
    const vpcAppstream = new ec2.Vpc(this, `${elemPrefix}-vpc-appstream`, {
      cidr: "172.24.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      // This subnet is configured for the IGW.
      // VPC class won't import new Subnet class instances declared in the code.
      // And no subnet can make trouble for VPC to make IGW in the initialization.
      subnetConfiguration: []
    });

    // Subnets
    const appStreamPrivateSubnetA = new ec2.PrivateSubnet(
      this,
      "appStreamPrivateSubnetA",
      {
        availabilityZone: "ap-northeast-2a",
        cidrBlock: "172.24.80.0/24",
        vpcId: vpcAppstream.vpcId,
        mapPublicIpOnLaunch: false
      }
    );

    const appStreamPrivateSubnetC = new ec2.PrivateSubnet(
      this,
      "appStreamPrivateSubnetC",
      {
        availabilityZone: "ap-northeast-2c",
        cidrBlock: "172.24.81.0/24",
        vpcId: vpcAppstream.vpcId,
        mapPublicIpOnLaunch: false
      }
    );

    const vpcSquid = new ec2.Vpc(this, `${elemPrefix}-vpc-squid`, {
      cidr: "10.254.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      // This subnet is configured for the IGW.
      // VPC class won't import new Subnet class instances declared in the code.
      // And no subnet can make trouble for VPC to make IGW in the initialization.
      subnetConfiguration: []
    });

    // Subnets
    const vpcSquidPublicSubnetA = new ec2.PrivateSubnet(
      this,
      "vpcSquidPublicSubnetA",
      {
        availabilityZone: "ap-northeast-2a",
        cidrBlock: "10.254.0.0/24",
        vpcId: vpcSquid.vpcId,
        mapPublicIpOnLaunch: false
      }
    );

    const vpcSquidPublicSubnetC = new ec2.PrivateSubnet(
      this,
      "vpcSquidPublicSubnetC",
      {
        availabilityZone: "ap-northeast-2c",
        cidrBlock: "10.254.1.0/24",
        vpcId: vpcSquid.vpcId,
        mapPublicIpOnLaunch: false
      }
    );    

    const vpcSquidPrivateSubnetA = new ec2.PrivateSubnet(
      this,
      "vpcSquidPrivateSubnetA",
      {
        availabilityZone: "ap-northeast-2a",
        cidrBlock: "10.254.80.0/24",
        vpcId: vpcSquid.vpcId,
        mapPublicIpOnLaunch: false
      }
    );

    const vpcSquidPrivateSubnetC = new ec2.PrivateSubnet(
      this,
      "vpcSquidPrivateSubnetC",
      {
        availabilityZone: "ap-northeast-2c",
        cidrBlock: "10.254.81.0/24",
        vpcId: vpcSquid.vpcId,
        mapPublicIpOnLaunch: false
      }
    );    

    const vpcSquidIgw = new ec2.CfnInternetGateway(this, "vpcSquid-igw");
    const vpcIgwAttachment = new ec2.CfnVPCGatewayAttachment(
      this,
      "vpcSquid-igw-attachment",
      {
        internetGatewayId: vpcSquidIgw.ref,
        vpcId: vpcSquid.vpcId
      }
    );

    vpcSquidPublicSubnetA.addDefaultInternetRoute(
      vpcSquidIgw.ref,
      vpcIgwAttachment
    );

    vpcSquidPublicSubnetC.addDefaultInternetRoute(
      vpcSquidIgw.ref,
      vpcIgwAttachment
    );

    // Create Endpoint for AppStream Streaming service

    const appstreamsg = new ec2.SecurityGroup(this, "appstreamsg", {
      vpc: vpcSquid,
      securityGroupName: `${elemPrefix}-appstreamsg`,
      description: "Squid server & Appstream combination test. This for the appstream vpce.",
      allowAllOutbound: true
    });

    appstreamsg.addIngressRule(
      ec2.Peer.ipv4('10.254.0.0/16'),
      ec2.Port.tcp(443),
      "allow all ips in a vpc for https - appstream api."
    );

    appstreamsg.addIngressRule(
      ec2.Peer.ipv4('10.254.0.0/16'),
      ec2.Port.tcpRange(1400, 1499),
      "allow all ips in a vpc for https - appstream streaming."
    )

    const appStreamEndpoint = new ec2.InterfaceVpcEndpoint(
      this,
      `${elemPrefix}-asvpcendpoint`,
      {
        service: {
          name: "com.amazonaws.ap-northeast-2.appstream.streaming",
          port: 443, // it's very wierd configuration element. Service Interface Endpoint doesn't have port attribute. aws ec2 describe-vpc-endpoints
          privateDnsDefault: true
        },
        vpc: vpcSquid,
        open: true,
        privateDnsEnabled: true,
        subnets: {
          subnets: [vpcSquidPrivateSubnetA, vpcSquidPrivateSubnetC]
        },
        securityGroups: [appstreamsg]
      }
    );

    // NAT Gateway via Squid Proxy
    const amznImage = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE
    });

    const httpsg = new ec2.SecurityGroup(this, "httpsg", {
      vpc: vpcSquid,
      securityGroupName: "test-squid-appstream-hhtpsg",
      description: "Squid server & Appstream combination test. http only security group",
      allowAllOutbound: true
    });

    httpsg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow public ssh"
    );

    httpsg.addIngressRule(
      ec2.Peer.ipv4('10.254.0.0/16'),
      ec2.Port.tcp(80),
      "allow private http"
    );

    httpsg.addIngressRule(
      ec2.Peer.ipv4("10.254.0.0/16"),
      ec2.Port.tcp(443),
      "allow private http"
    );

    httpsg.addIngressRule(
      ec2.Peer.ipv4("172.24.0.0/16"),
      ec2.Port.tcp(80),
      "allow appstream http"
    );

    httpsg.addIngressRule(
      ec2.Peer.ipv4("172.24.0.0/16"),
      ec2.Port.tcp(443),
      "allow appstream https"
    );

    const userdata = ec2.UserData.forLinux({
      shebang: `#!/bin/bash -ex
      exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
      echo BEGIN_USERSCRIPT
      date '+%Y-%m-%d %H:%M:%S'
      sudo yum update -y
      sudo yum install docker -y 
      sudo groupadd docker
      sudo usermod -a -G docker ec2-user
      sudo chkconfig docker on
      sudo service docker start
      docker pull sameersbn/squid:3.5.27-2
      docker run --name squid -d --restart=always \\
        --publish 3128:3128 \\
        --volume /srv/docker/squid/cache:/var/spool/squid \\
        sameersbn/squid:3.5.27-2
      echo END_USERSCRIPT
      `
    });

    const squidInst = new ec2.Instance(this, "squidInstanceA", {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: amznImage,
      vpc: vpcSquid,
      userData: userdata,
      allowAllOutbound: true,
      instanceName: `${elemPrefix}-squidInstanceA`,
      keyName: ec2keypair,
      securityGroup: httpsg,
      vpcSubnets: {
        subnets: [vpcSquidPublicSubnetA]
      },
      sourceDestCheck: false
    });

    const window2016Image = ec2.MachineImage.latestWindows(
      ec2.WindowsVersion.WINDOWS_SERVER_2016_KOREAN_FULL_BASE
    );

    const rdpsg = new ec2.SecurityGroup(this, "rdpsg", {
      vpc: vpcSquid,
      securityGroupName: "test-squid-appstream-rdpsg",
      description:
        "Squid server & Appstream combination test. rdp only security group",
      allowAllOutbound: true
    });

    rdpsg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3389),
      "allow public RDP"
    );

    const testwindowsInst = new ec2.Instance(this, "testwindowsInst", {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.LARGE
      ),
      machineImage: window2016Image,
      vpc: vpcSquid,
      allowAllOutbound: true,
      instanceName: `${elemPrefix}-testwindowsInst`,
      keyName: ec2keypair,
      securityGroup: rdpsg,
      vpcSubnets: {
        subnets: [vpcSquidPublicSubnetC]
      }
      //,sourceDestCheck: false
    });

    const testwindoweip = new ec2.CfnEIP(
      this, 
      `${elemPrefix}-vpcsquid-testwindoweip`,
      {
        domain: 'vpc'
      }
    )

    const testwindowseipassoc = new ec2.CfnEIPAssociation(
      this, 
      `${elemPrefix}-testwineipassoc`,
      {
        allocationId: testwindoweip.attrAllocationId,
        instanceId: testwindowsInst.instanceId
      }
    )

    vpcSquidPrivateSubnetA.addRoute(
      `${elemPrefix}-squid-rrnat-forpsa`,
      {
        routerId: squidInst.instanceId,
        routerType: ec2.RouterType.INSTANCE,
        destinationCidrBlock: "0.0.0.0/0",
        enablesInternetConnectivity: true
      }
    )

    vpcSquidPrivateSubnetC.addRoute(`${elemPrefix}-squid-rrnat-forpsb`, {
      routerId: squidInst.instanceId,
      routerType: ec2.RouterType.INSTANCE,
      destinationCidrBlock: "0.0.0.0/0",
      enablesInternetConnectivity: true
    });
    // Transit Gateway
    const tgw = new ec2.CfnTransitGateway(this, `${elemPrefix}-tgw-squid-appstream`, {

    });

    const tgwAttAppstream = new ec2.CfnTransitGatewayAttachment(
      this,
      `${elemPrefix}-tgwatt-appstream`,
      {
        subnetIds: [appStreamPrivateSubnetA.subnetId, appStreamPrivateSubnetC.subnetId],
        transitGatewayId: tgw.ref,
        vpcId: vpcAppstream.vpcId
      }
    );

    const tgwAttSquid = new ec2.CfnTransitGatewayAttachment(
      this,
      `${elemPrefix}-tgwatt-squid`,
      {
        subnetIds: [vpcSquidPrivateSubnetA.subnetId, vpcSquidPrivateSubnetC.subnetId],
        transitGatewayId: tgw.ref,
        vpcId: vpcSquid.vpcId
      }
    );

    const tgwRtInterVpc = new ec2.CfnTransitGatewayRouteTable(
      this,
      `${elemPrefix}-tgwrt-intervpc`,
      {
        transitGatewayId: tgw.ref
      }
    )

    const tgwRrAppstream = new ec2.CfnTransitGatewayRoute(
      this,
      `${elemPrefix}-tgwrr-intervpc-appstream`,
      {
        transitGatewayRouteTableId : tgwRtInterVpc.ref,
        blackhole: false,
        destinationCidrBlock: vpcAppstream.vpcCidrBlock,
        transitGatewayAttachmentId: tgwAttAppstream.ref
      }
    )

    const tgwRrSquid = new ec2.CfnTransitGatewayRoute(
      this,
      `${elemPrefix}-tgwrr-intervpc-squid`,
      {
        transitGatewayRouteTableId : tgwRtInterVpc.ref,
        blackhole: false,
        destinationCidrBlock: vpcSquid.vpcCidrBlock,
        transitGatewayAttachmentId: tgwAttSquid.ref
      }
    )

    // appstream configuration
    // CfnStack.AccessEndpointProperty.EndpointType : STREAMING
    const appstreamstack = new as.CfnStack(this, `${elemPrefix}-asstack`, {
      accessEndpoints: [
        {
          endpointType: "STREAMING",
          vpceId: appStreamEndpoint.vpcEndpointId
        }
      ],
      applicationSettings: {
        enabled: false,
        settingsGroup: ""
      },
      description: "AppStream Test Stack",
      displayName: "AppStreamTestStack",
      redirectUrl: "https://console.aws.amazon.com"
    });

    const ashttpshttpsg = new ec2.SecurityGroup(this, "ashttpshttpsg", {
      vpc: vpcAppstream,
      securityGroupName: "test-squid-appstream-ashttpshttpsg",
      description: "Squid server & Appstream combination test. http/https only security group",
      allowAllOutbound: true
    });

    ashttpshttpsg.addIngressRule(
      ec2.Peer.ipv4("172.24.0.0/16"),
      ec2.Port.tcp(80),
      "allow public http"
    );

    ashttpshttpsg.addIngressRule(
      ec2.Peer.ipv4("172.24.0.0/16"),
      ec2.Port.tcp(443),
      "allow public https"
    );

    const appstreamfleet = new as.CfnFleet(this, `${elemPrefix}-asfleet`, {
      computeCapacity: {
        desiredInstances: 1
      },
      description: "Compute Resource for Appstream 2.0",
      fleetType: "ON_DEMAND",
      name: `${elemPrefix}-asfleet-name`,
      instanceType: "stream.standard.medium",
      imageName: "Amazon-AppStream2-Sample-Image-02-04-2019",
      vpcConfig: {
        subnetIds: [
          appStreamPrivateSubnetA.subnetId,
          appStreamPrivateSubnetC.subnetId
        ],
        securityGroupIds: [ashttpshttpsg.securityGroupId]
      }
    });

  }
}
