import AppHandler from "./AppHandler";
import {MetricsMap} from "../Transformer";

export default class SeedReadHandler extends AppHandler {

    describe(): string {
        return `Seed read handler`;
    }

    async handle(debug: boolean): Promise<MetricsMap> {
        return await this.doSteps(
            /* 0 -  6*/ ...this.initialSteps(debug, AppHandler.userSteps),
            /* 7*/ () => this.click(`//a[@href='/account/settings']`),
            /* 8*/ () => this.waitFor("//button[contains(., 'Show') and @type='button']"),
            /* 9*/ () => this.clickNow("//button[contains(., 'Show') and @type='button']", 1),
            /*10*/ () => this.clickNow("svg.fa-copy", 1),
            /*11*/ () => { return this.checkSeed(); }
        );
    }

    protected async checkSeed(): Promise<number> {
        const obtainedSeed: string = await this.copy();
        if (obtainedSeed === this.seed)
            return 0;
        else
            throw new Error('Returned value does not match expected');
    }

}