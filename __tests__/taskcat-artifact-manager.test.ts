import "reflect-metadata";
import { ArtifactClient } from "../src/interfaces";
import { readFileSync, writeFileSync } from "fs";
import { sync } from "glob";
import * as replaceInFile from "replace-in-file";
import { mock } from "jest-mock-extended";
import * as core from "@actions/core";
import { TaskcatArtifactManagerImpl } from "../src/taskcat-artifact-manager";

jest.mock("fs");
jest.mock("glob");

describe("the TaskcatArtifactManager class", () => {
  beforeAll(() => {
    process.env.GITHUB_WORKSPACE = "/github/workspace";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockReplaceInFileSync = (replaceInFile.sync as unknown) as jest.MockedFunction<
    typeof replaceInFile.sync
  >;

  const mockedReadFileSync = (readFileSync as unknown) as jest.MockedFunction<
    typeof readFileSync
  >;

  const mockedWriteFileSync = (writeFileSync as unknown) as jest.MockedFunction<
    typeof writeFileSync
  >;
  const mockedGlobSync = (sync as unknown) as jest.MockedFunction<typeof sync>;

  const mockedArtifactClient = mock<ArtifactClient>();

  const taskcatArtifactManager = new TaskcatArtifactManagerImpl(
    mockedArtifactClient,
    mockReplaceInFileSync
  );

  describe("the maskAccountId function", () => {
    it("should not modify the `tasckat_output/` files if the AWS account ID has not been printed in the logs", () => {
      expect.assertions(1);

      const filePath = "taskcat_outputs/";
      const fileContents = "abcd1234";
      const awsAccountId = "1234567890";

      mockedGlobSync.mockReturnValue(["taskcat_outputs/test.txt"]);
      mockedReadFileSync.mockReturnValue(fileContents);

      taskcatArtifactManager.maskAccountId(awsAccountId, filePath);

      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it("should throw an exception if the AWS account ID has been passed as an empty string", () => {
      expect.assertions(2);

      const filePath = "taskcat_outputs/test.txt";
      const awsAccountId = "";

      expect(() => {
        taskcatArtifactManager.maskAccountId(awsAccountId, filePath);
      }).toThrow(Error);

      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it("should mask the AWS account ID from the `taskcat_outputs/` files if any references are found in the logs", () => {
      expect.assertions(1);

      const filePath = "taskcat_outputs/test.txt";
      const fileContents = "abcd1234 1234567890";
      const awsAccountId = "1234567890";

      mockedGlobSync.mockReturnValue(["taskcat_outputs/test.txt"]);
      mockedReadFileSync.mockImplementation((path, options?):
        | string
        | Buffer => {
        if (path === filePath && options === "utf-8") return fileContents;

        throw new Error();
      });

      taskcatArtifactManager.maskAccountId(awsAccountId, "taskcat_outputs/");

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        filePath,
        "abcd1234 ***",
        "utf-8"
      );
    });
  });

  describe("the publishTaskcatOutputs function", () => {
    it("should retrieve all files from the taskcat_output directory", () => {
      expect.assertions(1);

      mockedGlobSync.mockReturnValue([
        "taskcat_outputs/test1.txt",
        "taskcat_outputs/test2.txt",
      ]);

      const mockedArtifactClient = mock<ArtifactClient>();

      const taskcatArtifactManager = new TaskcatArtifactManagerImpl(
        mockedArtifactClient,
        replaceInFile.sync
      );

      taskcatArtifactManager.publishTaskcatOutputs("taskcat_outputs/");

      expect(mockedArtifactClient.uploadArtifact).toHaveBeenCalledWith(
        "taskcat_outputs",
        ["taskcat_outputs/test1.txt", "taskcat_outputs/test2.txt"],
        "taskcat_outputs/"
      );
    });
  });

  describe("the maskAndPublishTaskcatArtifacts function", () => {
    it("prints a debug message", () => {
      expect.assertions(1);

      const infoSpy = jest.spyOn(core, "info");

      jest.spyOn(taskcatArtifactManager, "maskAccountId").mockReturnValue();
      jest
        .spyOn(taskcatArtifactManager, "publishTaskcatOutputs")
        .mockReturnValue();

      taskcatArtifactManager.maskAndPublishTaskcatArtifacts("123456789");

      expect(infoSpy).toHaveBeenCalledWith(
        "Entered the maskAndPublishTaskcatArtifacts function"
      );
    });

    it("calls the maskAccountId function", () => {
      expect.assertions(1);

      const spy = jest
        .spyOn(taskcatArtifactManager, "maskAccountId")
        .mockReturnValue();

      taskcatArtifactManager.maskAndPublishTaskcatArtifacts("123456789");

      expect(spy).toHaveBeenCalledWith("123456789", "taskcat_outputs/");
    });

    it("calls the publishTaskcatOutputs function", () => {
      expect.assertions(1);

      process.env = Object.assign(process.env, {
        GITHUB_WORKSPACE: "/github/workspace",
      });

      jest.spyOn(taskcatArtifactManager, "maskAccountId").mockReturnValue();

      const spy = jest
        .spyOn(taskcatArtifactManager, "publishTaskcatOutputs")
        .mockReturnValue();

      taskcatArtifactManager.maskAndPublishTaskcatArtifacts("123456789");

      expect(spy).toHaveBeenCalledWith("/github/workspace/taskcat_outputs/");
    });
  });
});
