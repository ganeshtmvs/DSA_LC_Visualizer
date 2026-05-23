class Solution {
      public:
         double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
            int totalSize = nums1.size() + nums2.size();
            if (nums1.size() > nums2.size()) {
               return findMedianSortedArrays(nums2, nums1);
            }
            int left = 0;
            int right = nums1.size();
            while (left <= right) {
               visit(left);
               visit(right);
               int partitionX = (left + right) / 2;
               int partitionY = ((totalSize + 1) / 2) - partitionX;
               int maxLeftX = (partitionX == 0) ? INT_MIN : nums1[partitionX - 1];
               int minRightX = (partitionX == nums1.size()) ? INT_MAX : nums1[partitionX];
               int maxLeftY = (partitionY == 0) ? INT_MIN : nums2[partitionY - 1];
               int minRightY = (partitionY == nums2.size()) ? INT_MAX : nums2[partitionY];
               compare(maxLeftX, minRightY);
               compare(maxLeftY, minRightX);
               if (maxLeftX <= minRightY && maxLeftY <= minRightX) {
                  if (totalSize % 2 == 0) {
                     resolve(totalSize / 2, (std::max(maxLeftX, maxLeftY) + std::min(minRightX, minRightY)) / 2.0);
                     return (static_cast<double>(std::max(maxLeftX, maxLeftY)) + std::min(minRightX, minRightY)) / 2;
                  } else {
                     resolve(totalSize / 2, std::max(maxLeftX, maxLeftY));
                     return static_cast<double>(std::max(maxLeftX, maxLeftY));
                  }
               } else if (maxLeftX > minRightY) {
                  focus_pointer("left", partitionX);
                  focus_pointer("right", right);
                  right = partitionX - 1;
               } else {
                  focus_pointer("left", left);
                  focus_pointer("right", partitionX);
                  left = partitionX + 1;
               }
            }
            throw std::invalid_argument("No median found");
         }
   };