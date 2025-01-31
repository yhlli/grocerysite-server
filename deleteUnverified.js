const cron = require('node-cron');
const User = require('./models/User');

const UNVERIFIED_ACCOUNT_EXPIRY = 12*60*60*1000; //hour*min*sec*ms

// Schedule a cron job to run every hour
const deleteUnverified = async()=>{
    try {
        const currentTime = new Date();
        const expiryTime = new Date(currentTime - UNVERIFIED_ACCOUNT_EXPIRY);
        const result = await User.deleteMany({
            verified: false,
            createdAt: { $lt: expiryTime }
        });
        console.log(`Deleted ${result.deletedCount} unverified accounts.`);
    } catch (error) {
        console.error('Error deleting unverified accounts:', error);
    }
};
const schedule = '0 */6 * * *';
const job = cron.schedule(schedule, deleteUnverified);
job.start();
console.log('Cron job started to delete unverified accounts');
module.exports = { deleteUnverified };