## Media2Cloud V3 mini workshop series

Welcome to this mini workshop series of Media2Cloud V3 solution. The workshop consists of four tutorials that we discuss how to use the Media2Cloud solution programmatically.

* [Tutorial 1: Creating the Media2Cloud solution using AWS CloudFormation service](./1-creating-media2cloud-stack.md)
* [Tutorial 2: Using the Media2Cloud RESTful APIs to ingest and search contents](./2-using-media2cloud-restful-api.md)
* [Tutorial 3: Automating ingest and analysis workflow with Amazon EventBridge](./3-automate-ingest-analysis-workflow.md), and
* [Tutorial 4: Integrating Media2Cloud workflow to downstream process](./4-downstream-integration.md)

This is a hands-on workshop and uses numbers of command line tools: [AWS Command Line Interace (CLI)](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [cURL](https://curl.se/download.html), and [JQ](https://stedolan.github.io/jq/). Please read the Prerequisite section below and install the necessary tools before we start.

__

### Prerequisite

#### AWS CLI

[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) tool is used across all tutorials to create AWS resources.

_

#### cURL

[cURL](https://curl.se/download.html) tool is used to send authenticated HTTPS requests to the Media2Cloud API Endpoint in [Tutorial 2: Using the Media2Cloud RESTful APIs to ingest and search contents](./2-using-media2cloud-restful-api.md) and [Tutorial 4: Integrating Media2Cloud workflow to downstream process](./4-downstream-integration.md). Make sure the version of `cURL` on your system supports `--aws-sigv4` option which is AWS Signature Version 4 Authentication.

```shell
curl --help all | grep aws-sigv4

# You should see
--aws-sigv4 <provider1[:provider2[:region[:service]]]>  Use AWS V4 signature authentication

```

_

#### JQ

[JQ](https://stedolan.github.io/jq/) is a lightweight JSON parser. The tutorial uses it to parse JSON responses that we run with AWS CLI commands such as finding out specific Key / Value from the JSON response.

_


#### Google Chrome browser

Download and install [Google Chrome](https://www.google.com/chrome/) browser. After [Tutorial 1: Creating Media2Cloud solution](./1-creating-media2cloud-stack.md), we will access the Media2Cloud Web Portal through the browser.

_

#### Postman (Optional)

Bonus section in [Tutorial 2: Using the Media2Cloud RESTful APIs to ingest and search contents](./2-using-media2cloud-restful-api.md) describes how we can use Postman application to send authenicated HTTPS requests to Media2Cloud API Endpoint.

__

Let's start. Next to [Tutorial 1: Creating the Media2Cloud solution using AWS CloudFormation service](./1-creating-media2cloud-stack.md)

