const router = require('express').Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path   = require('path');
const db     = require('../db');
const mailer = require('../emails/mailer');
const auth   = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname,'../public/uploads'), limits:{ fileSize:20*1024*1024 } });

router.get('/stats', auth, (req,res) => {
  const total = db.countUserDocuments(req.user.id);
  const { plan, trialUsed } = req.user;
  const remaining = plan==='pro' ? '∞' : plan==='starter' ? Math.max(0,10-total) : trialUsed ? 0 : 1;
  res.json({ total, plan, remaining, trialUsed });
});

router.get('/documents', auth, (req,res) => res.json({ documents: db.getUserDocuments(req.user.id) }));

router.post('/documents', auth, (req,res) => {
  const { plan, trialUsed, id } = req.user;
  const count = db.countUserDocuments(id);
  if (plan==='free' && trialUsed) return res.status(403).json({ error:'trial_used', message:'Your free trial is used. Please upgrade to continue.' });
  if (plan==='starter' && count>=10) return res.status(403).json({ error:'limit_reached', message:'Starter plan limit reached. Upgrade to Pro for unlimited signing.' });
  if (plan==='free') { db.updateUser(id,{trialUsed:true}); mailer.sendTrialUsed({name:req.user.name,email:req.user.email}).catch(()=>{}); }
  const doc = db.createDocument({ userId:id, filename:req.body.filename||'document.pdf', originalName:req.body.originalName||'document.pdf' });
  res.json({ document:doc });
});

router.post('/signature', auth, (req,res) => {
  const { dataURL } = req.body;
  if (!dataURL) return res.status(400).json({ error:'No signature data' });
  const id = db.saveSignature({ userId:req.user.id, dataURL });
  res.json({ id });
});

router.get('/signature', auth, (req,res) => {
  const sig = db.getSignature(req.user.id);
  res.json({ signature: sig ? sig.dataURL : null });
});

router.put('/profile', auth, async (req,res) => {
  try {
    const updates = { name: req.body.name };
    if (req.body.password) {
      if (req.body.password.length<8) return res.status(400).json({ error:'Password must be 8+ characters' });
      updates.passwordHash = await bcrypt.hash(req.body.password,12);
    }
    const user = db.updateUser(req.user.id, updates);
    res.json({ user:{ id:user.id,name:user.name,email:user.email,plan:user.plan } });
  } catch(e) { res.status(500).json({ error:'Update failed' }); }
});

// AI placement logic — smart rule-based, no API cost
// Understands natural language placement instructions
router.post('/ai-place', auth, (req,res) => {
  const { instruction, pageWidth, pageHeight } = req.body;
  const ins = (instruction||'').toLowerCase().trim();
  const W = pageWidth  || 800;
  const H = pageHeight || 1100;

  // Signature dimensions (as % of page)
  const sigW = Math.round(W * 0.28);  // 28% of page width
  const sigH = Math.round(H * 0.065); // 6.5% of page height

  // ── Smart placement grid ──────────────────────────────
  // X positions (left edge of signature)
  const LEFT   = Math.round(W * 0.05);
  const CENTER = Math.round(W * 0.36);
  const RIGHT  = Math.round(W * 0.62);

  // Y positions (top edge of signature)
  const TOP    = Math.round(H * 0.06);
  const UPPER  = Math.round(H * 0.22);
  const MID    = Math.round(H * 0.44);
  const LOWER  = Math.round(H * 0.68);
  const BOTTOM = Math.round(H * 0.84);

  let x = RIGHT, y = BOTTOM; // default: bottom right

  // ── Parse instruction ─────────────────────────────────
  const has = (...words) => words.some(w => ins.includes(w));

  // Vertical position
  const isTop    = has('top','upper','head','header','beginning');
  const isBottom = has('bottom','lower','foot','footer','end','last');
  const isMid    = has('middle','center','centre','mid');
  const isLower  = has('lower third','below middle');

  // Horizontal position  
  const isLeft   = has('left');
  const isRight  = has('right');
  const isCentre = has('center','centre','middle','central') && !isLeft && !isRight;

  // Special zones
  const isAboveName  = has('above','above name','above my name','above printed','above signature line');
  const isBelowName  = has('below name','below printed','below my name','under name');
  const isNextDate   = has('date','next to date','beside date','by the date');
  const isSigLine    = has('signature line','sign here','signing line','dotted line','sign line');
  const isWitness    = has('witness','witnesses');
  const isInitial    = has('initial','initials','corner');
  const isFullPage   = has('full page','entire page','whole page');

  // Assign position
  if (isAboveName)       { x = LEFT;   y = Math.round(H * 0.76); }
  else if (isBelowName)  { x = LEFT;   y = BOTTOM; }
  else if (isSigLine)    { x = LEFT;   y = Math.round(H * 0.80); }
  else if (isNextDate)   { x = RIGHT;  y = BOTTOM; }
  else if (isWitness)    { x = CENTER; y = BOTTOM; }
  else if (isInitial)    { x = LEFT;   y = TOP; }
  else {
    // Grid-based placement
    if      (isTop    && isLeft)   { x = LEFT;   y = TOP;    }
    else if (isTop    && isRight)  { x = RIGHT;  y = TOP;    }
    else if (isTop    && isCentre) { x = CENTER; y = TOP;    }
    else if (isTop)                { x = CENTER; y = TOP;    }
    else if (isMid    && isLeft)   { x = LEFT;   y = MID;    }
    else if (isMid    && isRight)  { x = RIGHT;  y = MID;    }
    else if (isMid)                { x = CENTER; y = MID;    }
    else if (isBottom && isLeft)   { x = LEFT;   y = BOTTOM; }
    else if (isBottom && isRight)  { x = RIGHT;  y = BOTTOM; }
    else if (isBottom && isCentre) { x = CENTER; y = BOTTOM; }
    else if (isBottom)             { x = CENTER; y = BOTTOM; }
    else if (isLeft)               { x = LEFT;   y = BOTTOM; }
    else if (isRight)              { x = RIGHT;  y = BOTTOM; }
    else if (isCentre)             { x = CENTER; y = MID;    }
  }

  res.json({
    x, y,
    width: sigW,
    height: sigH,
    confidence: 'high',
    message: `Signature placed: ${instruction}`
  });
});

module.exports = router;
