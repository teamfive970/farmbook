import crypto from "node:crypto";
import { pool, query } from "../src/config/database.js";
import { encryptSecret, encryptionAvailable } from "../src/lib/crypto.js";
import { normalizePhone } from "../src/lib/phone.js";
import { hashPin, hashSecret, validatePinFormat } from "../src/lib/pin.js";
import { isSecurityQuestionKey, normalizeSecurityAnswer } from "../src/lib/recovery.js";
import { generateAccessCode, hashAccessCode, normalizeAccessCode } from "../src/lib/tokens.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? ((index += 1), next) : true;
  }
  return args;
}

function randomPin() {
  return String(crypto.randomInt(100000, 1000000));
}

async function main() {
  if (!pool) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.");
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (name.length < 2) {
    console.error(
      'Usage: npm run admin:create -- --name "Admin Name" [--code MND-XXXXXX] [--pin <6 digits>] [--phone 0770000000] [--question mother_first_name --answer "..."]'
    );
    process.exitCode = 1;
    return;
  }

  const code = args.code ? normalizeAccessCode(String(args.code)) : generateAccessCode();
  if (!code) {
    console.error("Invalid access code. Use 6 to 40 letters, numbers or dashes (e.g. MND-7KQ2P9).");
    process.exitCode = 1;
    return;
  }

  const pin = args.pin ? String(args.pin) : randomPin();
  if (!validatePinFormat(pin) || pin.length !== 6) {
    console.error("Invalid PIN. Admin PINs must be 6 digits. Leave out --pin to generate one.");
    process.exitCode = 1;
    return;
  }

  let phone = null;
  if (args.phone) {
    phone = normalizePhone(String(args.phone));
    if (!phone) {
      console.error("Invalid phone number. Use a Liberian number such as 0770000000.");
      process.exitCode = 1;
      return;
    }
  }

  let securityQuestion = null;
  let securityAnswerHash = null;
  if (args.question !== undefined || args.answer !== undefined) {
    if (!isSecurityQuestionKey(args.question)) {
      console.error(
        "Invalid recovery question. Use one of: mother_first_name, father_first_name, first_school, home_town, first_farm_animal."
      );
      process.exitCode = 1;
      return;
    }
    const answer = normalizeSecurityAnswer(String(args.answer || ""));
    if (!answer) {
      console.error("Provide an answer with --answer.");
      process.exitCode = 1;
      return;
    }
    securityQuestion = args.question;
    securityAnswerHash = await hashSecret(answer);
  }

  try {
    const { rows } = await query(
      `INSERT INTO admin_users
        (display_name, access_code_hash, access_code_ciphertext, phone_number, pin_hash,
         security_question, security_answer_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        name,
        hashAccessCode(code),
        encryptSecret(code),
        phone,
        await hashPin(pin),
        securityQuestion,
        securityAnswerHash
      ]
    );
    console.log("Admin account created.");
    console.log(`  ID:          ${rows[0].id}`);
    console.log(`  Name:        ${name}`);
    console.log(`  Access code: ${code}`);
    console.log(`  PIN:         ${pin}`);
    if (phone) console.log(`  Phone:       ${phone}`);
    if (securityQuestion) console.log(`  Recovery:    ${securityQuestion}`);
    console.log("");
    if (encryptionAvailable()) {
      console.log("The access code can be revealed later in Admin > Settings with the PIN.");
    } else {
      console.log(
        "CREDENTIAL_KEY is not set, so this code cannot be revealed later. Store it securely or set the key and replace the code."
      );
    }
    if (!phone && !securityQuestion) {
      console.log(
        "No phone or recovery question was set. Add one in Admin > Settings so this account can recover itself."
      );
    }
  } catch (error) {
    if (error?.code === "23505") {
      console.error("An admin with that access code or phone number already exists.");
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
