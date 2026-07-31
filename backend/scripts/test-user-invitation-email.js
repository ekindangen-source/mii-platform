require("dotenv").config();
const { sendUserInvitationEmail, verifyInvitationEmailTransport } = require("../services/userInvitationEmail");
const arg = name => { const p=`--${name}=`; const i=process.argv.find(v=>v.startsWith(p)); return i?i.slice(p.length):""; };
(async()=>{
  try{
    const to=arg("to")||process.env.SMTP_USER;
    if(!to) throw new Error("Use --to=email@example.com or set SMTP_USER.");
    console.log("Verifying SMTP connection..."); await verifyInvitationEmailTransport(); console.log("SMTP connection: OK");
    const result=await sendUserInvitationEmail({email:to,fullName:"MII Invitation Test",role:"viewer",token:"TEST_TOKEN_NOT_VALID_FOR_ACCEPTANCE_1234567890",expiresAt:new Date(Date.now()+86400000)});
    console.log("Test invitation email sent:",result.messageId);
  }catch(error){console.error("Invitation email test failed:",error);process.exitCode=1;}
})();
