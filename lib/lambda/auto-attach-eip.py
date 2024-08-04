import json
import boto3

def lambda_handler(event, context):

    ec2 = boto3.client('ec2')
    instance_id = event['detail']['instance-id']
    
    # 获取实例的信息
    instance_info = ec2.describe_instances(InstanceIds=[instance_id])
    
    # 获取实例的Tag信息
    tags = instance_info['Reservations'][0]['Instances'][0]['Tags']
     
    need_associate_EIP = False
    # 找到key为'Name'的tag，并输出其值
    for tag in tags:
        if tag['Key'] == 'EIP' and tag['Value'].lower() == 'true':
            need_associate_EIP = True
            print(f"EC2 instance:{instance_id} need to associate EIP")
            break
    else:
        print(f"EC2 instance:{instance_id} don't need to associate EIP")
        
    if not need_associate_EIP:
        return;
    
    # 获取网卡的ID
    network_interface_id = instance_info['Reservations'][0]['Instances'][0]['NetworkInterfaces'][0]['NetworkInterfaceId']
    
    # 网卡信息
    network_inter_info = ec2.describe_network_interfaces(
        Filters=[
            {'Name': 'network-interface-id', 'Values': [network_interface_id]}
        ]
    )
    
    print(f"network_interface_id:{network_interface_id}")
    print(network_inter_info)
    association_info = network_inter_info['NetworkInterfaces'][0]['Association']
   
    # Already associated EIP
    if 'AllocationId' in association_info and association_info['AllocationId'].startswith('eipalloc') and 'AssociationId' in association_info and association_info['AssociationId'].startswith('eipassoc'):
        print(f"Instance {instance_id} is already associated with EIP {association_info['PublicIp']}")
    else:
        # 使用waiter等待实例进入running状态
        waiter = ec2.get_waiter('instance_running')
        waiter.wait(InstanceIds=[instance_id])
        eip_allocation = ec2.allocate_address(Domain='vpc')
        eip_address = eip_allocation['PublicIp']
        associate_response = ec2.associate_address(
            InstanceId=instance_id,
            AllocationId=eip_allocation['AllocationId']
        )
        print(associate_response)
        print(f"Elastic IP {eip_address} associate to {instance_id} successfully")