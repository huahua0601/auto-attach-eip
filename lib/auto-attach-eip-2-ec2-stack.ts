import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'

export class AutoAttachEip2Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const autoAttachEIPLambdaRole = new iam.Role(this, 'AutoAttachEIPLambdaRole', {
      roleName: `auto-attach-eip-lambda--${cdk.Stack.of(this).region}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'AWSLambdaBasicExecutionRole', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'),
      ]
    });


    const autoAttachEIPLambda = new lambda.Function(this, 'AutoAttachEIPLambda', {
        runtime: lambda.Runtime.PYTHON_3_11,
        functionName: 'Auto-Attach-EIP-Func',
        handler: 'auto-attach-eip.lambda_handler',
        memorySize: 1024,
        timeout: cdk.Duration.seconds(120),
        code: lambda.Code.fromAsset('lib/lambda'),
        architecture: cdk.aws_lambda.Architecture.X86_64,
        logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
        role: autoAttachEIPLambdaRole,
    });

    autoAttachEIPLambda.addPermission('AllowEventBridgeInvocation', {
        principal: new iam.ServicePrincipal('events.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: `arn:aws:events:${this.region}:${this.account}:rule/*`, // Replace with your EventBridge rule ARN
    });

    const rule = new events.Rule(this, 'EC2-States-Events', {
        ruleName: 'EC2-States-Running-Event',
        eventPattern: {
          source: ["aws.ec2"],
          detailType: ["EC2 Instance State-change Notification"],
          detail: {
            state: ["running"]
          }
        }
      });
  
      // 将 Lambda 函数作为目标添加到规则中
      rule.addTarget(new targets.LambdaFunction(autoAttachEIPLambda));

  }
}
