const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const { authenticateToken } = require('../middleware/auth');

const execAsync = promisify(exec);
const router = express.Router();

router.use(authenticateToken);

// Get system info
router.get('/info', async (req, res) => {
    try {
        // CPU info
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || 'Unknown';
        const cpuCores = cpus.length;

        // Memory info
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryPercent = Math.round((usedMemory / totalMemory) * 100);

        // Uptime
        const uptime = os.uptime();
        const uptimeDays = Math.floor(uptime / 86400);
        const uptimeHours = Math.floor((uptime % 86400) / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);

        // Load average (Unix only)
        const loadAvg = os.loadavg();

        // Platform info
        const platform = os.platform();
        const release = os.release();
        const hostname = os.hostname();

        // Disk usage (try to get it)
        let diskInfo = { total: 0, used: 0, available: 0, percent: 0 };
        try {
            const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4,$5}'");
            const [total, used, available, percentStr] = stdout.trim().split(' ');
            diskInfo = {
                total: parseInt(total) || 0,
                used: parseInt(used) || 0,
                available: parseInt(available) || 0,
                percent: parseInt(percentStr) || 0
            };
        } catch (e) {
            // Ignore disk errors
        }

        // CPU usage (calculate from /proc/stat on Linux)
        let cpuPercent = 0;
        try {
            const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
            cpuPercent = parseFloat(stdout.trim()) || 0;
        } catch (e) {
            // Fallback: estimate from load average
            cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpuCores) * 100));
        }

        // Process info
        let processInfo = { nodeVersion: process.version, pid: process.pid, memoryUsage: process.memoryUsage() };

        // PM2 processes
        let pm2Processes = [];
        try {
            const { stdout } = await execAsync("pm2 jlist 2>/dev/null");
            pm2Processes = JSON.parse(stdout).map(p => ({
                name: p.name,
                status: p.pm2_env?.status || 'unknown',
                cpu: p.monit?.cpu || 0,
                memory: p.monit?.memory || 0,
                uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
                restarts: p.pm2_env?.restart_time || 0
            }));
        } catch (e) {
            // PM2 not available
        }

        res.json({
            success: true,
            data: {
                hostname,
                platform,
                release,
                cpu: {
                    model: cpuModel,
                    cores: cpuCores,
                    percent: cpuPercent,
                    loadAvg: loadAvg.map(l => l.toFixed(2))
                },
                memory: {
                    total: totalMemory,
                    used: usedMemory,
                    free: freeMemory,
                    percent: memoryPercent
                },
                disk: diskInfo,
                uptime: {
                    seconds: uptime,
                    formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
                },
                node: processInfo,
                pm2: pm2Processes,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('System info error:', error);
        res.status(500).json({ success: false, error: 'Failed to get system info' });
    }
});

// Get database stats
router.get('/database', async (req, res) => {
    try {
        const db = require('../config/database');

        // Get database size
        const sizeResult = await db.query(`
            SELECT pg_database_size(current_database()) as size
        `);

        // Get table counts
        const tablesResult = await db.query(`
            SELECT relname as table_name, n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                size: sizeResult.rows[0]?.size || 0,
                tables: tablesResult.rows
            }
        });
    } catch (error) {
        console.error('Database stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get database stats' });
    }
});

module.exports = router;
