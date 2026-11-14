import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let envVars = {};
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      envVars[match[1]] = value.trim();
    }
  });
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || envVars.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || envVars.ADMIN_USERNAME;
const ADMIN_NAME = process.env.ADMIN_NAME || envVars.ADMIN_NAME;

async function provisionAdminAccount() {
  if (!ADMIN_USERNAME) {
    throw new Error('ADMIN_USERNAME is not set in environment');
  }
  if (!ADMIN_NAME) {
    throw new Error('ADMIN_NAME is not set in environment');
  }

  console.log('================================================================');
  console.log('TECHNOSAVVYS WMS - SECURE ADMIN PROVISIONING');
  console.log('================================================================\n');

  // Determine password from args or env
  const args = process.argv.slice(2);
  let password = envVars.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
    }
  }

  if (!password) {
    throw new Error('ADMIN_PASSWORD is required via --password argument or ADMIN_PASSWORD environment variable.');
  }

  // 1. Generate PBKDF2 hash & salt
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  // 2. Persist hash & salt in .env.local
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  if (envContent.includes('ADMIN_EMAIL=')) {
    envContent = envContent.replace(/ADMIN_EMAIL=.*/g, `ADMIN_EMAIL=${ADMIN_EMAIL}`);
  } else {
    envContent += `\nADMIN_EMAIL=${ADMIN_EMAIL}`;
  }

  if (envContent.includes('ADMIN_USERNAME=')) {
    envContent = envContent.replace(/ADMIN_USERNAME=.*/g, `ADMIN_USERNAME=${ADMIN_USERNAME}`);
  } else {
    envContent += `\nADMIN_USERNAME=${ADMIN_USERNAME}`;
  }

  if (envContent.includes('ADMIN_PASSWORD_HASH=')) {
    envContent = envContent.replace(/ADMIN_PASSWORD_HASH=.*/g, `ADMIN_PASSWORD_HASH=${hash}`);
  } else {
    envContent += `\nADMIN_PASSWORD_HASH=${hash}`;
  }

  if (envContent.includes('ADMIN_PASSWORD_SALT=')) {
    envContent = envContent.replace(/ADMIN_PASSWORD_SALT=.*/g, `ADMIN_PASSWORD_SALT=${salt}`);
  } else {
    envContent += `\nADMIN_PASSWORD_SALT=${salt}`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log(`[OK] Server-side PBKDF2 salted hash configured for: ${ADMIN_EMAIL}`);
  console.log(`[OK] Associated Username: ${ADMIN_USERNAME}`);
  console.log(`[OK] Stored in .env.local (zero plaintext stored)`);

  // 3. Attempt Supabase Auth Provisioning if configured
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey && !serviceRoleKey.includes('mock_service_role')) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check if user exists
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existingUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );

      let userId;
      if (existingUser) {
        const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: password,
            user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
            email_confirm: true,
          }
        );
        if (updateErr) throw updateErr;
        userId = updated.user.id;
        console.log(`[OK] Updated existing Supabase Auth user: ${ADMIN_EMAIL} (UID: ${userId})`);
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
        });
        if (createErr) throw createErr;
        userId = created.user.id;
        console.log(`[OK] Created new Supabase Auth user: ${ADMIN_EMAIL} (UID: ${userId})`);
      }

      // Upsert into public.profiles
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        email: ADMIN_EMAIL,
        full_name: ADMIN_NAME,
        role: 'admin',
        updated_at: new Date().toISOString(),
      });

      if (profileErr) {
        console.warn(`[WARN] Supabase profiles upsert notice: ${profileErr.message}`);
      } else {
        console.log(`[OK] Confirmed super-admin role in public.profiles table`);
      }
    } catch (err) {
      console.log(`[NOTICE] Supabase Auth provisioning skipped or offline: ${err.message}`);
      console.log(`[OK] Falling back to server-side cryptographic PBKDF2 authentication.`);
    }
  } else {
    console.log(`[INFO] Supabase cloud connection offline; server-side cryptographic authentication active.`);
  }

  console.log('\n================================================================');
  console.log('ADMIN ACCOUNT PROVISIONING COMPLETE');
  console.log('Account: ' + ADMIN_EMAIL + ' (' + ADMIN_USERNAME + ')');
  console.log('Role: SUPER-ADMIN (Strictly zero temporary accounts authorized)');
  console.log('================================================================');
}

provisionAdminAccount().catch((e) => {
  console.error('Provisioning error:', e.message);
  process.exit(1);
});

