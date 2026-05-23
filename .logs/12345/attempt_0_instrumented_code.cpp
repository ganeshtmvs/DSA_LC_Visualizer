class Solution {
   public:
       double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
           int m = nums1.size();
           int n = nums2.size();
           if (m > n) {
               // Ensure that nums1 is the smaller array to simplify the logic
               return findMedianSortedArrays(nums2, nums1);
           }

           int totalLength = m + n;
           int halfLength = totalLength / 2;

           int left = 0;
           int right = m;

           while (left <= right) {
               int i = (left + right) / 2; // Partition for nums1
               int j = halfLength - i; // Partition for nums2

               // Calculate the values at the partitions
               int maxLeftX = (i == 0) ? INT_MIN : nums1[i - 1];
               int minRightX = (i == m) ? INT_MAX : nums1[i];

               int maxLeftY = (j == 0) ? INT_MIN : nums2[j - 1];
               int minRightY = (j == n) ? INT_MAX : nums2[j];

               visit(i);
               visit(j);

               compare(maxLeftX, maxLeftY);
               compare(minRightX, minRightY);

               if (maxLeftX <= minRightY && maxLeftY <= minRightX) {
                   // This partition results in the correct median
                   if (totalLength % 2 == 0) {
                       // For even total length, the median is the average of the two middle numbers
                       return (static_cast<double>(max(maxLeftX, maxLeftY)) + min(minRightX, minRightY)) / 2.0;
                   } else {
                       // For odd total length, the median is the middle number
                       resolve(halfLength, min(minRightX, minRightY));
                       return static_cast<double>(min(minRightX, minRightY));
                   }
               } else if (maxLeftX > minRightY) {
                   // The partition needs to move to the left in nums1
                   right = i - 1;
               } else {
                   // The partition needs to move to the right in nums1
                   left = i + 1;
               }
           }

           // If the function hasn't returned by now, it means the input arrays are not sorted
           throw runtime_error("Input arrays are not sorted");
       }
   };