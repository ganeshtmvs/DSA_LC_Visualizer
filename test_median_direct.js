// Direct test of /generate with a known-correct instrumented solution
// Bypasses LLM to verify the sandbox pipeline works

async function run() {
    const correctCode = `
class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        int m = nums1.size(), n = nums2.size();
        /* Ensure nums1 is the smaller array */
        if (m > n) return findMedianSortedArrays(nums2, nums1);

        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = (lo + hi) / 2;
            int j = (m + n + 1) / 2 - i;
            focus_pointer("i", i);
            focus_pointer("j", j);

            int left1  = (i == 0) ? INT_MIN : nums1[i - 1];
            int right1 = (i == m) ? INT_MAX : nums1[i];
            int left2  = (j == 0) ? INT_MIN : nums2[j - 1];
            int right2 = (j == n) ? INT_MAX : nums2[j];

            compare(i, j);

            if (left1 <= right2 && left2 <= right1) {
                /* Found correct partition */
                double median;
                if ((m + n) % 2 == 0) {
                    median = (max(left1, left2) + min(right1, right2)) / 2.0;
                } else {
                    median = max(left1, left2);
                }
                resolve(0, (int)median);
                return median;
            } else if (left1 > right2) {
                hi = i - 1;
            } else {
                lo = i + 1;
            }
        }
        return 0.0;
    }
};`;

    console.log("Testing /generate with a known-correct Median of Two Sorted Arrays solution...");
    const res = await fetch('http://localhost:3005/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: correctCode,
            array: '[1,3],[2]',
            noAI: true
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("FAILED:", err.error, err.details);
        return;
    }

    const data = await res.json();
    console.log("SUCCESS! Generated", data.steps.length, "trace steps.");
    console.log("Array:", data.array);
    data.steps.forEach((s, i) => {
        console.log(`  Step ${i+1}: [${s.action}] ${s.message || ''}`);
    });
}

run().catch(console.error);
