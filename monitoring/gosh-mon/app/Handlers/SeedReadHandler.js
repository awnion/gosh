"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppHandler_1 = __importDefault(require("./AppHandler"));
class SeedReadHandler extends AppHandler_1.default {
    describe() {
        return `Seed read handler`;
    }
    async handle(debug) {
        return await this.doSteps(
        /* 0 -  6*/ ...this.initialSteps(debug, AppHandler_1.default.userSteps), 
        /* 7*/ () => this.click(`//a[@href='/account/settings']`), 
        /* 8*/ () => this.waitFor("//button[contains(., 'Show') and @type='button']"), 
        /* 9*/ () => this.clickNow("//button[contains(., 'Show') and @type='button']", 1), 
        /*10*/ () => this.clickNow("svg.fa-copy", 1), 
        /*11*/ () => { return this.checkSeed(); });
    }
    async checkSeed() {
        const obtainedSeed = await this.copy();
        if (obtainedSeed === this.seed)
            return 0;
        else
            throw new Error('Returned value does not match expected');
    }
}
exports.default = SeedReadHandler;
