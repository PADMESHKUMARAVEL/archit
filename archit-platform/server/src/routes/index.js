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
const client = require('../controllers/clientController');
const projectBoard = require('../controllers/projectBoardController');

router.post('/auth/register', upload.image.single('photo'), asyncHandler(authC.register));
router.post('/auth/login', asyncHandler(authC.login));
router.get('/auth/me', auth, asyncHandler(authC.me));
router.post('/auth/password', auth, asyncHandler(authC.changePassword));
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
router.get('/posts/:id', auth, asyncHandler(posts.getOne));
router.post('/posts', auth, upload.postAttachment.fields([{ name: 'attachment', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), asyncHandler(posts.create));
router.delete('/posts/:id', auth, asyncHandler(posts.remove));
router.post('/posts/:id/like', auth, asyncHandler(posts.toggleLike));
router.get('/posts/:id/comments', auth, asyncHandler(posts.comments));
router.post('/posts/:id/comments', auth, asyncHandler(posts.addComment));

router.get('/jobs', auth, asyncHandler(jobs.list));
router.post('/jobs', auth, roles('ARCHITECT'), asyncHandler(jobs.create));
router.post('/jobs/:id/apply', auth, roles('STUDENT'), upload.postAttachment.single('attachment'), asyncHandler(jobs.apply));
router.get('/jobs/mine', auth, roles('ARCHITECT'), asyncHandler(jobs.mine));
router.get('/jobs/:id/applications', auth, roles('ARCHITECT'), asyncHandler(jobs.applications));
router.patch('/jobs/applications/:applicationId', auth, roles('ARCHITECT'), asyncHandler(jobs.updateApplication));

router.get('/client/dashboard', auth, roles('CLIENT'), asyncHandler(client.dashboard));
router.get('/client/profile', auth, roles('CLIENT'), asyncHandler(client.profile));
router.put('/client/profile', auth, roles('CLIENT'), asyncHandler(client.updateProfile));
router.get('/client/architects', auth, roles('CLIENT'), asyncHandler(client.architects));
router.get('/client/architects/:id', auth, roles('CLIENT'), asyncHandler(client.architect));
router.get('/client/saved-architects', auth, roles('CLIENT'), asyncHandler(client.savedArchitects));
router.post('/client/saved-architects/:architectId', auth, roles('CLIENT'), asyncHandler(client.saveArchitect));
router.delete('/client/saved-architects/:architectId', auth, roles('CLIENT'), asyncHandler(client.removeSavedArchitect));
router.get('/client/projects', auth, roles('CLIENT','ARCHITECT'), asyncHandler(client.projects));
router.get('/client/documents', auth, roles('CLIENT','ARCHITECT'), asyncHandler(client.documents));
router.get('/client/projects/:id', auth, roles('CLIENT','ARCHITECT'), asyncHandler(client.project));
router.post('/client/projects/:id/milestones', auth, roles('ARCHITECT'), asyncHandler(client.addMilestone));
router.patch('/client/projects/:id/milestones/:milestoneId', auth, roles('ARCHITECT'), asyncHandler(client.updateMilestone));
router.post('/client/projects/:id/updates', auth, roles('ARCHITECT'), asyncHandler(client.addProjectUpdate));
router.patch('/client/projects/:id/status', auth, roles('ARCHITECT'), asyncHandler(client.updateProjectStatus));
router.post('/client/projects/:id/documents', auth, roles('CLIENT','ARCHITECT'), upload.postAttachment.array('files', 5), asyncHandler(client.uploadProjectDocuments));

router.post('/enquiries/:architectId', auth, roles('CLIENT'), upload.postAttachment.array('files', 5), asyncHandler(enquiries.create));
router.get('/enquiries', auth, roles('CLIENT','ARCHITECT'), asyncHandler(enquiries.list));
router.get('/enquiries/:id', auth, roles('CLIENT','ARCHITECT'), asyncHandler(enquiries.detail));
router.patch('/enquiries/:id/status', auth, roles('ARCHITECT'), asyncHandler(enquiries.updateStatus));
router.patch('/enquiries/:id/cancel', auth, roles('CLIENT'), asyncHandler(enquiries.cancel));

router.get('/client/project-board', auth, roles('ARCHITECT'), asyncHandler(projectBoard.listBoard));
router.get('/client/project-requests', auth, roles('CLIENT'), asyncHandler(projectBoard.myRequests));
router.post('/client/project-requests', auth, roles('CLIENT'), upload.postAttachment.array('files', 5), asyncHandler(projectBoard.createRequest));
router.get('/client/project-requests/:id', auth, roles('CLIENT','ARCHITECT'), asyncHandler(projectBoard.detail));
router.post('/client/project-requests/:id/proposals', auth, roles('ARCHITECT'), asyncHandler(projectBoard.submitProposal));
router.patch('/client/project-requests/:id/proposals/:proposalId', auth, roles('CLIENT'), asyncHandler(projectBoard.updateProposal));
router.patch('/client/project-requests/:id/close', auth, roles('CLIENT'), asyncHandler(projectBoard.closeRequest));

router.get('/chat/conversations', auth, asyncHandler(chat.conversations));
router.get('/chat/:conversationId/messages', auth, asyncHandler(chat.messages));
router.post('/chat/:conversationId/messages', auth, upload.image.single('photo'), asyncHandler(chat.send));
router.delete('/chat/:conversationId/messages/:messageId', auth, asyncHandler(chat.deleteMessage));
router.delete('/chat/:conversationId/messages', auth, asyncHandler(chat.clearConversation));

module.exports = router;
