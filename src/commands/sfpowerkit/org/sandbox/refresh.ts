import {  flags } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
const request = require("request-promise-native");
import { Connection, Messages, SfdxError } from "@salesforce/core";
import { SFPowerkit, LoggerLevel } from "../../../../sfpowerkit";
import SFPowerkitCommand from "../../../../sfpowerkitCommand";
import QueryExecutor from "../../../../utils/queryExecutor";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("sfpowerkit", "sandbox_refresh");

export default class Refresh extends SFPowerkitCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:org:sandbox:refresh -n test2 -f sitSandbox -v myOrg@example.com`,
    `$ sfdx sfpowerkit:org:sandbox:refresh -n test2 -l DEVELOPER -v myOrg@example.com`,
    `$ sfdx sfpowerkit:org:sandbox:refresh -d Testsandbox -n test2 -f sitSandbox -v myOrg@example.com`,
    `$ sfdx sfpowerkit:org:sandbox:refresh -d Testsandbox -n test2 -l DEVELOPER -v myOrg@example.com`
  ];

  protected static flagsConfig = {
    name: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("nameFlagDescription")
    }),
    clonefrom: flags.string({
      required: false,
      char: "f",
      default: "",
      description: messages.getMessage("cloneFromFlagDescripton"),
      exclusive:['licensetype']
    }), 
    description: flags.string({
      required: false,
      char: "d",
      description: messages.getMessage("descriptionFlagDescription")
    }),
    licensetype: flags.string({
      required: false,
      char: "l",
      options: ["DEVELOPER", "DEVELOPER_PRO", "PARTIAL", "FULL"],
      description: messages.getMessage("licenseFlagDescription"),
      exclusive:['clonefrom']
    })
  };

  // Comment this out if your command does not require a hub org username
  protected static requiresDevhubUsername = true;

  public async execute(): Promise<AnyJson> {
    SFPowerkit.setLogLevel("INFO", false);

    await this.hubOrg.refreshAuth();

    const conn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await conn.retrieveMaxApiVersion());

    let result;
    let [sandboxId, sandboxDescription] = await this.getSandboxDetails(conn, this.flags.name);
    const uri = `${conn.instanceUrl}/services/data/v${this.flags.apiversion}/tooling/sobjects/SandboxInfo/${sandboxId}/`;


    //Both flags are exclusive, so only one gets triggered
    let request;
    if (this.flags.clonefrom) {
      const sourceSandboxId = await this.getSandboxDetails(
        conn,
        this.flags.clonefrom
      );
      request=this.buildRefreshRequest(this.flags.description?this.flags.description:sandboxDescription,null,sourceSandboxId);
    }
    if (this.flags.licensetype) {
      request=this.buildRefreshRequest(this.flags.description?this.flags.description:sandboxDescription,this.flags.licensetype,null);
    }
    
   //TODO: Add Polling 
   let result=await request(request);
    SFPowerkit.log(
      `Successfully Enqueued Refresh of Sandbox`,
      LoggerLevel.INFO
    );
    return result;
  }

  public buildRefreshRequest(description:string,licenseType?:string,sourceSandboxId?:string)
  {
    let request = {
      method: "patch",
      url: uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`
      },
      body: {
        AutoActivate: "true",
        Description: description
      },
      json: true
    }
    if(licenseType)
      request.body.LicenseType=licenseType;
     else
     request.body.SourceId=sourceSandboxId;
    
     
    
    return request;
  }

  public async getSandboxDetails(conn: Connection, name: string) {
    let queryUtil = new QueryExecutor(conn);
    const query = `SELECT Id, Description FROM SandboxInfo WHERE SandboxName in ('${name}')`;
    let sandbox_query_result = await queryUtil.executeQuery(query, true);

   if (sandbox_query_result[0] == undefined)
     throw new SfdxError(
       `Unable to continue, Please check your sandbox name: ${name}`
      );

    this.ux.log();

    SFPowerkit.log(
      `Fetched Sandbox Id, Description for sandbox  ${name}  is ${sandbox_query_result[0].Id}, ${sandbox_query_result[0].Description}`,
      LoggerLevel.INFO
    );

    return [sandbox_query_result[0].Id, sandbox_query_result[0].Description];
  }

}
