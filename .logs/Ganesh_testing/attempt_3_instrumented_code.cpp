class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        int m = nums1.size(), n = nums2.size();
        if (m > n) return findMedianSortedArrays(nums2, nums1);
        int low = 0, high = m;

        while (true) {
            visit(0)
            focus_pointer("left", low);
            int midLeft = (low + high) / 2,
                midRight = m - midLeft;
            int l1 = getKthElement(nums1, midLeft),
                r1 = getKthElement(nums1, midLeft + 1),
                l2 = getKthElement(nums2, midRight),
                r2 = getKthElement(nums2, midRight + 1);
            if ((l1 <= l2 && l2 <= r1) || (r2 < r1)) {
                focus_pointer("left", low);
                low = midLeft + 1;
                visit(0)
            }
            else if ((l1 >= l2 && l2 >= r1) || (l1 > r2)) {
                focus_pointer("right", high);
                high = midLeft;
                visit(0)
            }
            else {
                compare(low, high);
                return findKthElement(nums1, nums2, (m + n - 1) / 2);
            }
        }
    }
    int getKthElement(vector<int>& nums, int k)
    {
        int start = 0, end = nums.size() - 1;
        while (true) {
            visit(start + (end - start) / 2);
            if (k == start + 1) return nums[start];
            else if (k &lt;= start + 1) end = start - 1;
            else k -= start + 1, start = start + 1;
        }
    }
};