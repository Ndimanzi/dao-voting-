import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hardhat from "hardhat";

const { ethers, network } = hardhat;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  if (network.name === "sepolia") {
    if (!process.env.SEPOLIA_RPC_URL) {
      throw new Error("SEPOLIA_RPC_URL is not set.");
    }

    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY is not set.");
    }
  }

  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();

  const deploymentsDir = path.resolve(__dirname, "..", "deployments");
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);

  await mkdir(deploymentsDir, { recursive: true });
  await writeFile(
    deploymentFile,
    JSON.stringify(
      {
        network: network.name,
        address: dao.target,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`DAO deployed to: ${dao.target}`);
  console.log(`Saved deployment to: ${deploymentFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
