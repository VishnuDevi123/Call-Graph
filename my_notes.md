1.Given a node,the incoming node to it is alwsay on its left side and outgoing node is lawsy on its right side which is fine, but if there are methods in the same column level, method 1 outgoing node is going from the right and that edge is becoming incoming node to the differnt method of same column to the left. This is causing massive edges closing and jumbling with each other. 
So having a columnar based is causing UX problems and viewing the callers and calles with jumbled arrows is confusing. There should be proper node spacing out rather than all the callee appearing in one level. The earliest should be on the farthest left and then the sequence continues to wards the right. 



2.Does the module node needs to be the callee for the very first function? 

3.Is the graph layout limited to the graph size itself? It should be unlimited rather than being calculated from the callers and calle levels. This is useless code. 

4.The top CALLERS, FOCUSED FUNCTION, CALLEES needs to be removed. It is not pairing well when the depth is icreasing and causing indentation issues. Rather this we can use a color code. All callers one color code, focused function with another color code and callees with another color code. 

5.prior button, with a symbol and when hovered on that needs to show previous focused function which stores the previous focused function and if the user goes deeper into the caller, it can be help ful for the user to go back to the previous focused function. 
Need to add a reset button to get back to the initial size of the layout, at, not resetting the Depth levels at all


6.The reset of Depth Callers and Depth Callee should not be happening when the focused function is changed. It should remain constant unitl the user changes it back. 


7.remove the unresolved calls and extenal calls feature.