const router = require('express').Router();
const { auth, roles } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const authC = require('../controllers/authController');
const userC = require('../controllers/userController');
const network = require('../controllers/networkController');
const posts = require('../controllers/postController');
const jobs = require('../controllers/jobController');
const enquiries = require('../controllers/enquiryController');
const chat = require('../controllers/chatController');
const upload = require('../middleware/upload');
const notifications = require('../controllers/notificationController');

router.post('/auth/register', asyncHandler(authC.register));
router.post('/auth/login', asyncHandler(authC.login));
router.get('/auth/me', auth, asyncHandler(authC.me));
router.get('/notifications', auth, asyncHandler(notifications.list));
router.patch('/notifications/read-all', auth, asyncHandler(notifications.readAll));
router.patch('/notifications/:id/read', auth, asyncHandler(notifications.read));

router.get('/users', auth, asyncHandler(userC.search));
router.get('/users/:id/posts', auth, asyncHandler(posts.byUser));
router.get('/users/:id', auth, asyncHandler(userC.getOne));
router.patch('/users/me', auth, asyncHandler(userC.updateMe));
router.post('/users/me/photo', auth, upload.image.single('photo'), asyncHandler(userC.updatePhoto));

router.post('/network/request/:userId', auth, asyncHandler(network.send));
router.get('/network/requests', auth, asyncHandler(network.requests));
router.get('/network/requests/sent', auth, asyncHandler(network.sentRequests));
router.patch('/network/requests/:id', auth, asyncHandler(network.respond));
router.get('/network/connections', auth, asyncHandler(network.connections));
router.get('/network/status/:userId', auth, asyncHandler(network.status));

router.get('/posts', auth, asyncHandler(posts.list));
router.post('/posts', auth, upload.postAttachment.fields([{ name: 'attachment', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), asyncHandler(posts.create));
router.post('/posts/:id/like', auth, asyncHandler(posts.toggleLike));
router.get('/posts/:id/comments', auth, asyncHandler(posts.comments));
router.post('/posts/:id/comments', auth, asyncHandler(posts.addComment));

router.get('/jobs', auth, asyncHandler(jobs.list));
router.post('/jobs', auth, roles('ARCHITECT'), asyncHandler(jobs.create));
router.post('/jobs/:id/apply', auth, roles('STUDENT'), upload.postAttachment.single('attachment'), asyncHandler(jobs.apply));
router.get('/jobs/mine', auth, roles('ARCHITECT'), asyncHandler(jobs.mine));
router.get('/jobs/:id/applications', auth, roles('ARCHITECT'), asyncHandler(jobs.applications));
router.patch('/jobs/applications/:applicationId', auth, roles('ARCHITECT'), asyncHandler(jobs.updateApplication));

router.post('/enquiries/:architectId', auth, roles('CLIENT'), asyncHandler(enquiries.create));
router.get('/enquiries', auth, roles('CLIENT','ARCHITECT'), asyncHandler(enquiries.list));

router.get('/chat/conversations', auth, asyncHandler(chat.conversations));
router.get('/chat/:conversationId/messages', auth, asyncHandler(chat.messages));
router.post('/chat/:conversationId/messages', auth, upload.image.single('photo'), asyncHandler(chat.send));

module.exports = router;
